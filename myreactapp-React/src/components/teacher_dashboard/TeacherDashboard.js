import React, { useState, useEffect, useMemo, useRef } from 'react';
import { listSubjects, getSubjectEnrolledStudents, fetchMe, uploadTeacherProfilePicture, deleteTeacherProfilePicture, getStudentAttendanceHistory, fetchAllStudentsForTeacher, enrollStudentToSubject, saveSubjectSchedules, markStudentAttendance } from '../../api/client';
import { getOnlineStudents, getIncognitoAlerts, getRealtimeBrowserActivity } from '../../api/browserMonitoring';
import { presentationTeacherActive, presentationEnd } from '../../api/presentations';
import ThemeToggle from '../../components/ThemeToggle';

// Extracted components
import ScreenMonitoringSection from '../ScreenMonitoringSection';
import BrowserMonitoringSection from './BrowserMonitoringSection';
import TeacherPresentationSection from './TeacherPresentationSection';
import StudentsTimeClockSection from '../StudentsTimeClockSection';
import AttendanceSection from './sections/AttendanceSection';
import ClassScheduleSection from './sections/ClassScheduleSection';
import TeacherQuizSection from './sections/TeacherQuizSection';
import StudentProfileModal from './modals/StudentProfileModal';
import EditAttendanceModal from './modals/EditAttendanceModal';
import AttendanceHistoryModal from './modals/AttendanceHistoryModal';
import BrowserActivityModal from './modals/BrowserActivityModal';
import AddStudentsModal from './modals/AddStudentsModal';
import StaffDashboardSettings from '../StaffDashboardSettings';
import { getMonitoringPollSeconds, getNotifyIncognitoDesktop } from '../../utils/dashboardPrefs';
import { getApiBase } from '../../config/apiBase';

export default function TeacherDashboard() {
  const [user, setUser] = useState(null);
  const [activeSection, setActiveSection] = useState('subjects');
  const [subjects, setSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showStudentProfile, setShowStudentProfile] = useState(false);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [profilePictureUrl, setProfilePictureUrl] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [updatingAttendance, setUpdatingAttendance] = useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [updatingRecord, setUpdatingRecord] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  // Browser monitoring states
  const [onlineStudents, setOnlineStudents] = useState([]);
  const [incognitoAlerts, setIncognitoAlerts] = useState([]);
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [studentActivity, setStudentActivity] = useState([]);
  const [currentViewStudent, setCurrentViewStudent] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [realtimeActivity, setRealtimeActivity] = useState([]);
  // Add Student modal states
  const [showAddStudentsModal, setShowAddStudentsModal] = useState(false);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [addStudentsTab, setAddStudentsTab] = useState('bsit');
  const [addStudentsSearchTerm, setAddStudentsSearchTerm] = useState('');
  const [subjectSchedules, setSubjectSchedules] = useState([]);
  // Screen Monitoring drill-down: null = subject picker, object = viewing that subject
  const [selectedMonitoringSubject, setSelectedMonitoringSubject] = useState(null);
  // Cached enrolled student IDs per subject id, used to filter screen grid
  const [monitoringEnrollmentCache, setMonitoringEnrollmentCache] = useState({});
  const [loadingMonitoringSubject, setLoadingMonitoringSubject] = useState(null);
  const fileInputRef = useRef(null);
  const alertsPollInitializedRef = useRef(false);
  const seenIncognitoAlertIdsRef = useRef(new Set());
  const [monitoringPollSec, setMonitoringPollSec] = useState(() => getMonitoringPollSeconds());
  
  // Global Presentation Banner State
  const [globalPresentation, setGlobalPresentation] = useState(null);
  const [endingGlobalPresentation, setEndingGlobalPresentation] = useState(false);

  const getProfilePictureUrl = (profilePicture) => {
    if (!profilePicture) return null;
    if (typeof profilePicture !== 'string') return null;
    if (profilePicture.startsWith('data:')) return profilePicture;
    if (profilePicture.startsWith('http')) return profilePicture;
    const apiBase = getApiBase();
    if (profilePicture.startsWith('/storage/')) return `${apiBase}${profilePicture}`;
    if (profilePicture.startsWith('storage/')) return `${apiBase}/${profilePicture}`;
    return `${apiBase}/storage/${profilePicture}`;
  };

  // Poll for online students and incognito alerts
  useEffect(() => {
    const fetchOnlineData = async () => {
      try {
        const [studentsResp, alertsResp, activityResp] = await Promise.all([
          getOnlineStudents(), getIncognitoAlerts(), getRealtimeBrowserActivity()
        ]);
        console.log('👥 Online students response:', studentsResp);
        console.log('🚨 Incognito alerts response:', alertsResp);
        console.log('📊 Real-time activity response:', activityResp);

        if (studentsResp.ok && studentsResp.data) {
          setOnlineStudents(Array.isArray(studentsResp.data) ? studentsResp.data : []);
        } else if (Array.isArray(studentsResp)) {
          setOnlineStudents(studentsResp);
        }
        let alertsList = [];
        if (alertsResp.ok && alertsResp.data) {
          alertsList = Array.isArray(alertsResp.data) ? alertsResp.data : [];
        } else if (Array.isArray(alertsResp)) {
          alertsList = alertsResp;
        }
        setIncognitoAlerts(alertsList);

        if (Array.isArray(alertsList)) {
          if (!alertsPollInitializedRef.current) {
            alertsList.forEach((a) => {
              if (a && a.id != null) seenIncognitoAlertIdsRef.current.add(a.id);
            });
            alertsPollInitializedRef.current = true;
          } else if (
            typeof window !== 'undefined' &&
            typeof Notification !== 'undefined' &&
            getNotifyIncognitoDesktop() &&
            Notification.permission === 'granted'
          ) {
            alertsList.forEach((a) => {
              if (!a || a.id == null || seenIncognitoAlertIdsRef.current.has(a.id)) return;
              seenIncognitoAlertIdsRef.current.add(a.id);
              if (a.is_acknowledged) return;
              try {
                new Notification('SMART — Incognito alert', {
                  body: 'A student may be browsing in incognito. Review Browser Monitoring.',
                  tag: `smart-incognito-${a.id}`,
                });
              } catch (_) {}
            });
          }
        }
        if (activityResp.ok && activityResp.data) {
          setRealtimeActivity(Array.isArray(activityResp.data) ? activityResp.data : []);
        } else if (Array.isArray(activityResp)) {
          setRealtimeActivity(activityResp);
        }
      } catch (error) {
        console.error('❌ Failed to fetch online data:', error);
      }
    };
    fetchOnlineData();
    const interval = setInterval(fetchOnlineData, Math.max(5000, monitoringPollSec * 1000));
    return () => clearInterval(interval);
  }, [monitoringPollSec]);

  // Poll for active presentation to show global banner
  useEffect(() => {
    let mounted = true;
    const checkActivePresentation = async () => {
      try {
        const s = await presentationTeacherActive();
        if (mounted && s?.active && s?.session) {
          setGlobalPresentation(s.session);
        } else if (mounted) {
          setGlobalPresentation(null);
        }
      } catch (_) {}
    };
    checkActivePresentation();
    const interval = setInterval(checkActivePresentation, 3000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleGlobalStopPresentation = async () => {
    if (!globalPresentation?.uuid) return;
    setEndingGlobalPresentation(true);
    try {
      await presentationEnd(globalPresentation.uuid);
      setGlobalPresentation(null);
    } catch (_) {
    } finally {
      setEndingGlobalPresentation(false);
    }
  };

  const getAttendanceSummary = (student) => {
    if (!student) return { present: 0, late: 0, absent: 0 };
    const attendance = student.attendance_summary;
    if (attendance && typeof attendance === 'object') {
      return { present: Number(attendance.present) || 0, late: Number(attendance.late) || 0, absent: Number(attendance.absent) || 0 };
    }
    return { present: 0, late: 0, absent: 0 };
  };

  const attendanceSummary = useMemo(() => getAttendanceSummary(selectedStudent), [selectedStudent]);
  const attendanceBreakdown = useMemo(() => {
    const stats = attendanceSummary;
    const total = Math.max(stats.present + stats.late + stats.absent, 1);
    const entries = [
      { label: 'Present', value: stats.present, color: '#ef4444', gradient: 'from-red-500 to-red-400', border: 'border-red-200 dark:border-red-500/40', muted: 'text-red-600 dark:text-red-300' },
      { label: 'Late', value: stats.late, color: '#f43f5e', gradient: 'from-rose-500 to-rose-400', border: 'border-rose-200 dark:border-rose-500/40', muted: 'text-rose-500 dark:text-rose-300' },
      { label: 'Absent', value: stats.absent, color: '#ef4444', gradient: 'from-rose-500 to-rose-500', border: 'border-rose-200 dark:border-rose-500/40', muted: 'text-rose-500 dark:text-rose-300' },
    ].map((entry) => ({ ...entry, percent: total ? Math.round((entry.value / total) * 100) : 0 }));
    return { total, entries };
  }, [attendanceSummary]);

  const attendanceChartGradient = useMemo(() => {
    const { total, entries } = attendanceBreakdown;
    if (!entries || total === 0) return 'conic-gradient(#e2e8f0 0deg 360deg)';
    let cumulative = 0;
    const segments = entries.map((entry) => {
      const angle = total ? (entry.value / total) * 360 : 0;
      const start = cumulative;
      cumulative += angle;
      return `${entry.color} ${start}deg ${cumulative}deg`;
    });
    return `conic-gradient(${segments.join(', ')})`;
  }, [attendanceBreakdown]);

  // Add custom animations
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slideIn { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
      .animate-slideIn { animation: slideIn 0.4s ease-out; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetchMe();
        if (mounted) {
          const userData = res?.ok ? res.data : res;
          if (userData) {
            setUser(userData);
            try { localStorage.setItem('user', JSON.stringify(userData)); } catch (_) { }
            return;
          }
        }
      } catch (_) { }
      try {
        const userData = JSON.parse(localStorage.getItem('user'));
        if (mounted) setUser(userData);
      } catch (_) { }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const loadSubjects = async () => {
      try {
        setLoadingSubjects(true);
        const res = await listSubjects();
        if (res?.ok && res?.data) { setSubjects(res.data); }
        else if (Array.isArray(res)) { setSubjects(res); }
      } catch (e) { console.error('❌ Load subjects error:', e); }
      finally { setLoadingSubjects(false); }
    };
    loadSubjects();
  }, []);

  // Reset Screen Monitoring drill-down when navigating away from the section
  useEffect(() => {
    if (activeSection !== 'screen-monitoring') {
      setSelectedMonitoringSubject(null);
    }
  }, [activeSection]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/';
  };

  const isStudentOnline = (studentId) =>
    onlineStudents.some((s) => Number(s.id) === Number(studentId));

  const getOnlineStudentInfo = (studentId) =>
    onlineStudents.find((s) => Number(s.id) === Number(studentId)) || null;
  const hasIncognitoAlert = (studentId) => {
    if (!Array.isArray(incognitoAlerts)) return false;
    return incognitoAlerts.some(a => a.student_user_id === studentId && !a.is_acknowledged);
  };

  const handleViewActivity = async (student) => {
    setCurrentViewStudent(student);
    setActivityModalOpen(true);
    setStudentActivity([]);
    try {
      const { getStudentBrowserActivity } = await import('../../api/browserMonitoring');
      const resp = await getStudentBrowserActivity(student.id, { per_page: 50 });
      if (resp.ok && resp.data) {
        setStudentActivity(resp.data.data || resp.data || []);
      } else { setStudentActivity([]); }
    } catch (error) {
      console.error('Failed to fetch student browsing history:', error);
      setStudentActivity([]);
    }
  };

  const teacherInfo = useMemo(() => {
    if (!user) return null;
    const fullName = user.full_name || user.fullName || user.name || '';
    return { name: fullName, email: user.email || '', profilePicture: user.profile_picture || user.profilePicture || null };
  }, [user]);

  useEffect(() => {
    if (teacherInfo?.profilePicture) {
      let pictureUrl = teacherInfo.profilePicture;
      if (pictureUrl.startsWith('data:')) { setProfilePictureUrl(pictureUrl); }
      else if (!pictureUrl.startsWith('http')) {
        const base = getApiBase();
        if (pictureUrl.startsWith('/storage/')) pictureUrl = `${base}${pictureUrl}`;
        else if (pictureUrl.startsWith('storage/')) pictureUrl = `${base}/${pictureUrl}`;
        else pictureUrl = `${base}/storage/${pictureUrl}`;
        setProfilePictureUrl(pictureUrl);
      } else { setProfilePictureUrl(pictureUrl); }
    } else { setProfilePictureUrl(null); }
  }, [teacherInfo?.profilePicture]);

  const loadSubjectContext = async (subject, openModal = false) => {
    if (!subject) return;
    setSelectedSubject(subject);
    if (openModal) setShowStudentsModal(true);
    setLoadingStudents(true);
    try {
      const res = await getSubjectEnrolledStudents(subject.id);
      if (res?.ok) {
        setEnrolledStudents(res.data || []);
        setSubjectSchedules(Array.isArray(res.schedules) ? res.schedules : []);
      }
      else { setEnrolledStudents([]); }
    } catch (e) { console.log('Error loading enrolled students:', e); setEnrolledStudents([]); }
    finally { setLoadingStudents(false); }
  };

  const handleSubjectClick = async (subject) => {
    await loadSubjectContext(subject, true);
  };

  const handleSelectSubjectFromTabs = async (subjectId) => {
    const subject = subjects.find((s) => Number(s.id) === Number(subjectId));
    if (!subject) return;
    await loadSubjectContext(subject, false);
  };

  // Load enrolled students for a specific subject, cache IDs for filter
  const loadMonitoringSubjectEnrollment = async (subject) => {
    if (!subject) return null;
    const sid = String(subject.id);
    const current = monitoringEnrollmentCache[sid];
    if (current && Array.isArray(current.studentIds)) return current;
    setLoadingMonitoringSubject(sid);
    try {
      const res = await getSubjectEnrolledStudents(subject.id);
      const students = Array.isArray(res?.data) ? res.data : [];
      const studentIds = students.map((s) => Number(s.id));
      const payload = { studentIds, students, subject };
      setMonitoringEnrollmentCache((prev) => ({ ...prev, [sid]: payload }));
      return payload;
    } catch (e) {
      console.error('❌ Load monitoring subject enrollment error:', e);
      return { studentIds: [], students: [], subject };
    } finally {
      setLoadingMonitoringSubject(null);
    }
  };

  const handleMonitoringSubjectClick = async (subject) => {
    await loadMonitoringSubjectEnrollment(subject);
    setSelectedMonitoringSubject(subject);
  };

  const handleMonitoringBackToSubjects = () => {
    setSelectedMonitoringSubject(null);
  };

  const handleSaveSchedules = async (schedules) => {
    if (!selectedSubject) {
      return { ok: false, error: 'Select a subject first.' };
    }
    const response = await saveSubjectSchedules(selectedSubject.id, schedules);
    if (!response?.ok) {
      return { ok: false, error: response.error || 'Failed to save schedule' };
    }
    const saved = response.data?.data || [];
    setSubjectSchedules(saved);
    return { ok: true };
  };

  const handleMarkAttendanceFromTab = async (studentId, status, reason) => {
    if (!selectedSubject) {
      return { ok: false, error: 'Select a subject first.' };
    }
    try {
      const res = await markStudentAttendance(selectedSubject.id, studentId, status, reason);
      if (!res?.ok) {
        return { ok: false, error: res?.message || 'Failed to mark attendance' };
      }
      const refreshed = await getSubjectEnrolledStudents(selectedSubject.id);
      if (refreshed?.ok) {
        setEnrolledStudents(refreshed.data || []);
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.response?.data?.message || 'Failed to mark attendance' };
    }
  };

  const groupStudentsBySection = (students) => {
    const grouped = {};
    students.forEach(student => {
      const section = student.section || 'No Section';
      if (!grouped[section]) grouped[section] = [];
      grouped[section].push(student);
    });
    return grouped;
  };

  const loadAvailableStudentsForSubject = async (subjectId) => {
    try {
      const subject = subjects.find(s => s.id === subjectId);
      if (!subject) return;
      const enrolledRes = await getSubjectEnrolledStudents(subjectId);
      const currentEnrolled = enrolledRes?.ok ? (enrolledRes.data || []) : [];
      setEnrolledStudents(currentEnrolled);
      const studentsRes = await fetchAllStudentsForTeacher();
      if (studentsRes?.ok) {
        const enrolledIds = currentEnrolled.map(s => s.id);
        setAvailableStudents(studentsRes.data.filter(student => !enrolledIds.includes(student.id)));
        setAddStudentsSearchTerm('');
        setShowAddStudentsModal(true);
      }
    } catch (e) { console.error('Error in loadAvailableStudentsForSubject:', e); setAvailableStudents([]); }
  };

  const enrollStudent = async (student) => {
    if (!selectedSubject) return;
    try {
      const res = await enrollStudentToSubject(selectedSubject.id, student.id);
      if (res?.ok) {
        const enrolledRes = await getSubjectEnrolledStudents(selectedSubject.id);
        if (enrolledRes?.ok) setEnrolledStudents(enrolledRes.data || []);
        setAvailableStudents(prev => prev.filter(s => s.id !== student.id));
        alert(`${student.full_name} has been enrolled successfully!`);
      } else { alert(res?.message || 'Failed to enroll student'); }
    } catch (e) { alert(e?.response?.data?.message || 'Network error'); }
  };

  // Fetch attendance history when history modal is opened
  useEffect(() => {
    if (showHistoryModal && selectedStudent && selectedSubject) {
      setLoadingHistory(true);
      getStudentAttendanceHistory(selectedSubject.id, selectedStudent.id)
        .then((res) => { if (res?.ok && res.data?.ok) { setAttendanceHistory(res.data.data || []); } else { setAttendanceHistory([]); } })
        .catch(() => { setAttendanceHistory([]); })
        .finally(() => { setLoadingHistory(false); });
    }
  }, [showHistoryModal, selectedStudent, selectedSubject]);

  return (
    <div className="relative flex h-[100dvh] min-h-0 w-full max-w-[100vw] overflow-hidden">
      {/* Background */}
      <div aria-hidden className="teacher-aurora pointer-events-none absolute inset-0 -z-10" />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-dotgrid opacity-60" />
        <div className="absolute -top-32 -left-32 h-[30rem] w-[30rem] rounded-full bg-slate-400/40 mix-blend-multiply blur-3xl animate-blob" />
        <div className="absolute -top-20 right-0 h-[28rem] w-[28rem] rounded-full bg-rose-400/35 mix-blend-multiply blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute -bottom-32 left-1/3 h-[26rem] w-[26rem] rounded-full bg-rose-400/30 mix-blend-multiply blur-3xl animate-blob animation-delay-4000" />
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden animate-fade-in-slow"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-[min(100vw-2rem,280px)] sm:w-80 lg:w-72 lg:max-h-[95vh] lg:h-[95vh] lg:my-auto lg:ml-6
        max-h-[100dvh] overflow-hidden
        glass-strong lg:rounded-[1.75rem]
        transform transition-all duration-500 cubic-bezier(0.22,1,0.36,1)
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Left accent bar */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-red-500 via-rose-500 to-rose-500 opacity-95" aria-hidden />
        <div className="h-full overflow-y-auto p-4 lg:p-6 pl-5 lg:pl-7">
          <div className="mb-6 flex items-center justify-between lg:mb-8">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-red-500/40 via-rose-500/30 to-rose-500/40 blur-lg opacity-70" aria-hidden />
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/80 p-1.5 shadow-soft ring-1 ring-white/80 dark:bg-slate-800/70 dark:ring-white/10 lg:h-12 lg:w-12 backdrop-blur">
                  <img src={`${process.env.PUBLIC_URL}/favicon.svg`} alt="" className="h-full w-full object-contain" />
                </div>
              </div>
              <div>
                <h1 className="text-red-700 dark:text-red-400 text-lg font-extrabold tracking-tight lg:text-xl">
                  S.M.A.R.T
                </h1>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Faculty Console</p>
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="space-y-1.5">
            {[
              { id: 'profile',           label: 'View Profile',         badgeColor: 'bg-slate-50 text-red-500 dark:bg-slate-950/40 dark:text-red-400 dark:group-hover:bg-slate-900/50 group-hover:bg-slate-100', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
              { id: 'subjects',          label: 'My Subjects',          badgeColor: 'bg-rose-50 text-rose-500 dark:bg-rose-950/40 dark:text-rose-400 dark:group-hover:bg-rose-900/50 group-hover:bg-rose-100',         icon: 'M12 6l7 2-7 2-7-2 7-2zM5 10l7 2 7-2M5 14l7 2 7-2' },
              { id: 'attendance',        label: 'Attendance',           badgeColor: 'bg-red-50 text-red-500 dark:bg-red-950/40 dark:text-red-400 dark:group-hover:bg-red-900/50 group-hover:bg-red-100', icon: 'M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z' },
              { id: 'schedule',          label: 'Class Schedule',       badgeColor: 'bg-rose-50 text-rose-500 dark:bg-rose-950/40 dark:text-rose-400 dark:group-hover:bg-rose-900/50 group-hover:bg-rose-100',   icon: 'M8 7V3m8 4V3m-9 8h10m-11 9h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v11a2 2 0 002 2z' },
              { id: 'monitoring',        label: 'Browser Monitoring',   badgeColor: 'bg-slate-50 text-red-500 dark:bg-slate-950/40 dark:text-red-400 dark:group-hover:bg-slate-900/50 group-hover:bg-slate-100',         icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
              { id: 'screen-monitoring', label: 'Screen Monitoring',    badgeColor: 'bg-slate-50 text-red-500 dark:bg-slate-950/40 dark:text-red-400 dark:group-hover:bg-slate-900/50 group-hover:bg-slate-100',  icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
              { id: 'live-presentation', label: 'Live screen share',    badgeColor: 'bg-red-50 text-rose-500 dark:bg-red-950/40 dark:text-rose-400 dark:group-hover:bg-red-900/50 group-hover:bg-red-100', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
              { id: 'quizzes',            label: 'Quizzes & Exams',      badgeColor: 'bg-red-50 text-rose-500 dark:bg-red-950/40 dark:text-rose-400 dark:group-hover:bg-red-900/50 group-hover:bg-red-100', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
              { id: 'time-clock',        label: 'Students time-in / out', badgeColor: 'bg-rose-50 text-rose-500 dark:bg-rose-950/40 dark:text-rose-400 dark:group-hover:bg-rose-900/50 group-hover:bg-rose-100',          icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
              { id: 'settings',          label: 'Settings',             badgeColor: 'bg-slate-50 text-slate-500 dark:bg-slate-800/40 dark:text-slate-400 dark:group-hover:bg-slate-700/50 group-hover:bg-slate-100',        icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
            ].map((item) => {
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { setActiveSection(item.id); setMobileMenuOpen(false); }}
                  className={`group relative flex w-full items-center rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-300 ease-out overflow-hidden
                    ${active
                      ? 'text-white shadow-glow bg-gradient-to-r from-red-500 via-rose-500 to-rose-500 bg-size-200 animate-gradient-shift'
                      : 'text-slate-700 hover:bg-white/70 hover:text-red-600 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-red-300 hover:translate-x-0.5 hover:shadow-soft'
                    }`}
                >
                  <span className={`mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300
                    ${active
                      ? 'bg-white/20 text-white shadow-inner'
                      : item.badgeColor
                    }`}
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                    </svg>
                  </span>
                  <span className="relative z-10 whitespace-nowrap">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Logout Button */}
          <div className="mt-6 lg:mt-8 pt-6 border-t border-slate-200/60 dark:border-slate-700/60">
            <div className="relative group">
              <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-red-500 via-rose-500 to-rose-500 opacity-30 blur-md group-hover:opacity-50 transition-opacity duration-300" aria-hidden />
              <button
                onClick={handleLogout}
                className="relative w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-white rounded-2xl bg-gradient-to-r from-red-500 via-rose-500 to-rose-500 bg-size-200 animate-gradient-shift shadow-[0_8px_24px_-8px_rgba(99,102,241,0.5)] hover:shadow-[0_12px_32px_-8px_rgba(99,102,241,0.7)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 overflow-hidden"
              >
                <span className="absolute inset-0 bg-shimmer opacity-0 group-hover:opacity-100 transition-opacity duration-500" aria-hidden />
                <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20 shadow-inner backdrop-blur">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </span>
                <span className="relative whitespace-nowrap">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden lg:p-6">
        <div className="glass-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="sticky top-0 z-40 border-b border-white/40 dark:border-white/10 bg-white/60 backdrop-blur-2xl dark:bg-slate-900/50">
            <div className="px-4 py-4 lg:px-8 lg:py-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(true)}
                    className="shrink-0 rounded-lg p-2 text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800 lg:hidden"
                  >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 lg:gap-3">
                      <span className="hidden h-8 w-1 shrink-0 rounded-full bg-gradient-to-b from-red-500 via-rose-500 to-rose-500 shadow-[0_0_12px_rgba(99,102,241,0.5)] lg:block" aria-hidden />
                      <h2 className="truncate text-xl font-bold tracking-tight text-transparent bg-gradient-to-r from-red-600 via-rose-600 to-rose-600 bg-clip-text dark:from-red-400 dark:via-rose-400 dark:to-rose-400 lg:text-3xl">
                        {activeSection === 'profile' ? 'My Profile' : activeSection === 'subjects' ? 'My Subjects' : activeSection === 'attendance' ? 'Attendance' : activeSection === 'schedule' ? 'Class Schedule' : activeSection === 'monitoring' ? 'Browser Monitoring' : activeSection === 'screen-monitoring' ? 'Screen Monitoring' : activeSection === 'live-presentation' ? 'Live screen share' : activeSection === 'quizzes' ? 'Quizzes & Exams' : activeSection === 'time-clock' ? 'Students time-in / time-out' : activeSection === 'settings' ? 'Settings' : 'Professor Dashboard'}
                      </h2>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs font-medium text-slate-700 dark:text-slate-200 lg:text-sm">
                      {activeSection === 'profile' ? 'View your professor profile and information' : activeSection === 'subjects' ? 'View and manage the subjects assigned to you' : activeSection === 'attendance' ? 'Mark attendance quickly with a dedicated daily workspace' : activeSection === 'schedule' ? 'Set and update class day/time windows for attendance check-in' : activeSection === 'monitoring' ? 'Monitor student browser activity in your subjects' : activeSection === 'screen-monitoring' ? 'View live desktop thumbnails from lab PCs (Desktop App)' : activeSection === 'live-presentation' ? 'Broadcast your desktop to enrolled students in the browser (WebRTC)' : activeSection === 'quizzes' ? 'Generate a quiz from your module with AI and lock student screens until they finish' : activeSection === 'time-clock' ? 'PC lab sign-in and sign-out history by course, section, and date' : activeSection === 'settings' ? 'Account, live refresh interval, and incognito alert notifications' : 'Professor Dashboard'}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 lg:gap-3">
                  <div className="relative hidden lg:flex items-center gap-3 rounded-2xl px-5 py-2.5 bg-white/70 backdrop-blur-xl border border-white/60 shadow-soft dark:bg-slate-900/60 dark:border-white/10">
                    <span className="relative flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-gradient-to-br from-red-400 to-red-600 shadow-[0_0_12px_rgba(16,185,129,0.7)]" />
                    </span>
                    <div className="text-sm text-slate-700 dark:text-slate-200">
                      Welcome,{' '}
                      <span className="font-bold text-red-700 dark:text-red-400">{user?.full_name || user?.name || 'Professor'}</span>
                    </div>
                  </div>
                  <ThemeToggle />
                  <div className="relative group">
                    <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-red-500 via-rose-500 to-rose-500 opacity-0 group-hover:opacity-40 blur transition-opacity duration-300" aria-hidden />
                    <button
                      type="button"
                      onClick={handleLogout}
                      title="Logout"
                      className="relative flex items-center gap-2 rounded-2xl bg-gradient-to-r from-red-500 via-rose-500 to-rose-500 bg-size-200 animate-gradient-shift px-4 py-2.5 text-xs font-bold text-white shadow-glow hover:scale-[1.03] active:scale-[0.97] transition-all duration-300 lg:text-sm"
                    >
                      <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span className="hidden sm:inline">Logout</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {/* Global Active Presentation Banner */}
            {globalPresentation && (
              <div className="bg-rose-500 text-white px-4 py-2 flex flex-wrap items-center justify-between gap-4 animate-slideIn">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                  </span>
                  <span className="text-sm font-semibold tracking-wide">
                    Live Screen Share Active {globalPresentation.subject_name ? `for ${globalPresentation.subject_name}` : ''}
                  </span>
                </div>
                <button
                  onClick={handleGlobalStopPresentation}
                  disabled={endingGlobalPresentation}
                  className="px-4 py-1.5 bg-white text-rose-600 font-bold rounded-lg text-xs hover:bg-rose-50 transition-colors shadow-sm disabled:opacity-50"
                >
                  {endingGlobalPresentation ? 'Stopping...' : 'Stop Sharing'}
                </button>
              </div>
            )}
          </header>

          <div className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4 lg:p-8">
            {/* Profile Section */}
            {activeSection === 'profile' && (
              <div className="max-w-4xl mx-auto">
                <div className="bg-white/10 backdrop-blur-sm shadow-2xl rounded-2xl border border-slate-200/50 dark:bg-slate-900/10 dark:border-slate-800/50 overflow-hidden">
                  <div className="p-4 lg:p-8">
                    {!teacherInfo ? (
                      <div className="text-center py-12">
                        <div className="w-20 h-20 bg-slate-100/10 backdrop-blur-sm dark:bg-slate-800/10 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 font-medium">No Professor information found.</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="flex items-center space-x-4 pb-6 border-b border-slate-200 dark:border-slate-800">
                          <div className="relative flex-shrink-0">
                            {profilePictureUrl ? (
                              <div className="relative">
                                <img src={profilePictureUrl} alt="Profile" className="w-20 h-20 rounded-full object-cover border-4 border-rose-200 dark:border-rose-800 shadow-lg" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                                <div className="w-20 h-20 bg-gradient-to-br from-rose-500 to-red-600 rounded-full flex items-center justify-center shadow-lg hidden">
                                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                </div>
                              </div>
                            ) : (
                              <div className="w-20 h-20 bg-gradient-to-br from-rose-500 to-red-600 rounded-full flex items-center justify-center shadow-lg">
                                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                              </div>
                            )}
                            <button onClick={() => fileInputRef.current?.click()} disabled={uploadingPicture} className="absolute bottom-0 right-0 w-7 h-7 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center shadow-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed" title="Change profile picture">
                              {uploadingPicture ? (
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              )}
                            </button>
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > 2 * 1024 * 1024) { alert('File size must be less than 2MB'); return; }
                              setUploadingPicture(true);
                              try {
                                const res = await uploadTeacherProfilePicture(file);
                                if (res?.ok) {
                                  const userRes = await fetchMe();
                                  const userData = userRes?.ok ? userRes.data : userRes;
                                  if (userData) { setUser(userData); try { localStorage.setItem('user', JSON.stringify(userData)); } catch (_) { } }
                                } else { alert(res?.message || 'Failed to upload profile picture'); }
                              } catch (error) { alert('Failed to upload profile picture: ' + (error.response?.data?.message || error.message)); }
                              finally { setUploadingPicture(false); e.target.value = ''; }
                            }} />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{teacherInfo.name || 'Professor'}</h4>
                            <p className="text-sm text-slate-600 dark:text-slate-400">{teacherInfo.email || '-'}</p>
                            <span className="inline-block mt-2 px-3 py-1 text-xs font-semibold rounded-full bg-slate-100/40 backdrop-blur-sm text-red-800 dark:bg-slate-900/30 dark:text-red-300">Professor</span>
                            {profilePictureUrl && (
                              <button onClick={async () => {
                                if (window.confirm('Are you sure you want to delete your profile picture?')) {
                                  try {
                                    const res = await deleteTeacherProfilePicture();
                                    if (res?.ok) { const userRes = await fetchMe(); const userData = userRes?.ok ? userRes.data : userRes; if (userData) { setUser(userData); try { localStorage.setItem('user', JSON.stringify(userData)); } catch (_) { } } }
                                    else { alert(res?.message || 'Failed to delete profile picture'); }
                                  } catch (error) { alert('Failed to delete profile picture: ' + (error.response?.data?.message || error.message)); }
                                }
                              }} className="mt-2 text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300">Remove picture</button>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-800/10 rounded-xl p-5 border border-red-200/50 dark:border-red-800/30">
                            <div className="flex items-center space-x-3 mb-2">
                              <div className="w-10 h-10 bg-slate-500 rounded-lg flex items-center justify-center"><svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></div>
                              <div className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">Full Name</div>
                            </div>
                            <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{teacherInfo.name || '-'}</div>
                          </div>
                          <div className="bg-gradient-to-br from-rose-50 to-rose-100/50 dark:from-rose-900/20 dark:to-rose-800/10 rounded-xl p-5 border border-rose-200/50 dark:border-rose-800/30">
                            <div className="flex items-center space-x-3 mb-2">
                              <div className="w-10 h-10 bg-rose-500 rounded-lg flex items-center justify-center"><svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg></div>
                              <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Email</div>
                            </div>
                            <div className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate">{teacherInfo.email || '-'}</div>
                          </div>
                          <div className="bg-gradient-to-br from-red-900 to-red-800/10 dark:from-red-900/20 dark:to-red-800/10 rounded-xl p-5 border border-rose-200/50 dark:border-rose-800/30">
                            <div className="flex items-center space-x-3 mb-2">
                              <div className="w-10 h-10 bg-rose-500 rounded-lg flex items-center justify-center"><svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Subjects Section */}
            {activeSection === 'subjects' && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3 bg-gradient-to-r from-rose-50 to-red-50 dark:from-rose-900/30 dark:to-red-900/30 border border-rose-200/60 dark:border-rose-800/60 px-4 py-2 rounded-xl shadow-md">
                    <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                    <span className="text-sm font-semibold text-rose-700 dark:text-rose-100">{subjects.length} Subject{subjects.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                {loadingSubjects ? (
                  <div className="text-center py-12 text-slate-600 dark:text-slate-400">Loading subjects...</div>
                ) : subjects.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {subjects.map((subject) => (
                      <div key={subject.id} onClick={() => handleSubjectClick(subject)} className="group bg-white/40 backdrop-blur-md overflow-hidden shadow-lg rounded-2xl hover:shadow-2xl hover:shadow-rose-500/20 transition-all duration-300 transform hover:-translate-y-1 cursor-pointer border border-white/20 hover:border-rose-300 dark:bg-slate-800/40 dark:border-white/5">
                        <div className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex-shrink-0">
                              <div className="w-16 h-16 bg-gradient-to-br from-rose-100 to-red-100 rounded-lg flex items-center justify-center shadow-lg dark:from-rose-900/30 dark:to-red-900/20">
                                <svg className="w-8 h-8 text-rose-600 dark:text-rose-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6l7 2-7 2-7-2 7-2zM5 10l7 2 7-2M5 14l7 2 7-2" /></svg>
                              </div>
                            </div>
                            <div className="flex-1 ml-4">
                              <h3 className="text-lg font-medium text-slate-800 truncate hover:text-rose-700 transition-colors duration-300 dark:text-slate-100 dark:hover:text-rose-300">{subject.name}</h3>
                              <p className="text-sm text-rose-600 font-mono bg-rose-50/60 backdrop-blur-sm px-2 py-1 rounded dark:text-rose-200 dark:bg-rose-900/30 dark:border dark:border-rose-700">{subject.code}</p>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-900 dark:text-slate-50 font-semibold">Course:</span><span className="text-xs text-rose-600 bg-rose-50/60 backdrop-blur-sm px-3 py-1 rounded-full border border-rose-200/60 dark:text-rose-200 dark:bg-rose-900/30 dark:border-rose-700/50">{subject.course}</span></div>
                            <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-900 dark:text-slate-50 font-semibold">Section:</span><span className="text-xs text-rose-600 bg-rose-50/60 backdrop-blur-sm px-3 py-1 rounded-full border border-rose-200/60 truncate dark:text-rose-200 dark:bg-rose-900/30 dark:border-rose-700/50">{subject.section}</span></div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between"><span className="text-xs text-slate-500 font-medium dark:text-slate-400">Created</span><span className="text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded dark:text-slate-400 dark:bg-slate-800">{new Date(subject.created_at).toLocaleDateString()}</span></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-12 text-center shadow-xl dark:bg-slate-900/10 dark:border-slate-800/60">
                    <svg className="w-16 h-16 text-slate-300 mx-auto mb-4 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6l7 2-7 2-7-2 7-2zM5 10l7 2 7-2M5 14l7 2 7-2" /></svg>
                    <div className="text-slate-400 text-base font-medium mb-2 dark:text-slate-500">No subjects assigned</div>
                    <div className="text-slate-300 text-sm dark:text-slate-500">You don't have any subjects assigned to you yet. Contact the administrator.</div>
                  </div>
                )}
              </div>
            )}

            {/* Browser Monitoring Section */}
            {activeSection === 'attendance' && (
              <AttendanceSection
                subjects={subjects}
                loadingSubjects={loadingSubjects}
                selectedSubject={selectedSubject}
                enrolledStudents={enrolledStudents}
                loadingStudents={loadingStudents}
                onSelectSubject={handleSelectSubjectFromTabs}
                onMarkAttendance={handleMarkAttendanceFromTab}
                onOpenHistory={(student) => {
                  setSelectedStudent(student);
                  setShowHistoryModal(true);
                }}
                isStudentOnline={isStudentOnline}
                getOnlineStudentInfo={getOnlineStudentInfo}
              />
            )}

            {activeSection === 'schedule' && (
              <ClassScheduleSection
                subjects={subjects}
                loadingSubjects={loadingSubjects}
                selectedSubject={selectedSubject}
                subjectSchedules={subjectSchedules}
                onSelectSubject={handleSelectSubjectFromTabs}
                onSaveSchedules={handleSaveSchedules}
              />
            )}

            {activeSection === 'monitoring' && (
              <BrowserMonitoringSection subjects={subjects} loadingSubjects={loadingSubjects} isStudentOnline={isStudentOnline} hasIncognitoAlert={hasIncognitoAlert} handleViewActivity={handleViewActivity} />
            )}

            {activeSection === 'screen-monitoring' && !selectedMonitoringSubject && (
              <div className="mb-8">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
                  <div className="flex items-center space-x-3 bg-gradient-to-r from-rose-50 to-red-50 dark:from-rose-900/30 dark:to-red-900/30 border border-rose-200/60 dark:border-rose-800/60 px-4 py-2 rounded-xl shadow-md">
                    <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                    <span className="text-sm font-semibold text-rose-700 dark:text-rose-100">
                      Select a subject to view student screens
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    {subjects.length} Subject{subjects.length !== 1 ? 's' : ''} · Click a card to open screen monitoring
                  </div>
                </div>
                {loadingSubjects ? (
                  <div className="text-center py-12 text-slate-600 dark:text-slate-400">Loading subjects…</div>
                ) : subjects.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {subjects.map((subject) => {
                      const sid = String(subject.id);
                      const cached = monitoringEnrollmentCache[sid];
                      const enrolledIds =
                        cached && Array.isArray(cached.studentIds) ? cached.studentIds : [];
                      let countOnline = 0;
                      const enrolledIdsSet = new Set(enrolledIds);
                      onlineStudents.forEach((s) => {
                        if (enrolledIdsSet.has(Number(s.id))) countOnline++;
                      });
                      const countOnlineDisplay = cached && cached.students
                        ? cached.students.filter((s) => isStudentOnline(s.id)).length
                        : countOnline;
                      const isLoading = loadingMonitoringSubject === sid;
                      return (
                        <div
                          key={subject.id}
                          onClick={() => handleMonitoringSubjectClick(subject)}
                          className="group bg-white/40 backdrop-blur-md overflow-hidden shadow-lg rounded-2xl hover:shadow-2xl hover:shadow-rose-500/20 transition-all duration-300 transform hover:-translate-y-1 cursor-pointer border border-white/20 hover:border-rose-300 dark:bg-slate-800/40 dark:border-white/5"
                        >
                          <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex-shrink-0">
                                <div className="w-16 h-16 bg-gradient-to-br from-rose-100 to-red-100 rounded-lg flex items-center justify-center shadow-lg dark:from-rose-900/30 dark:to-red-900/20">
                                  <svg
                                    className="w-8 h-8 text-rose-600 dark:text-rose-300"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="2"
                                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                                    />
                                  </svg>
                                </div>
                              </div>
                              <div className="flex flex-col items-end space-y-2">
                                <div className="flex items-center space-x-2">
                                  {countOnlineDisplay > 0 ? (
                                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200">
                                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-1 animate-pulse" />
                                      {countOnlineDisplay} online
                                    </span>
                                  ) : (
                                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                      No one online
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-rose-600 font-mono bg-rose-50/60 backdrop-blur-sm px-2 py-1 rounded dark:text-rose-200 dark:bg-rose-900/30 dark:border dark:border-rose-700">
                                  {subject.code}
                                </span>
                              </div>
                            </div>
                            <h3 className="text-lg font-semibold text-slate-800 truncate group-hover:text-rose-700 transition-colors duration-300 dark:text-slate-100 dark:group-hover:text-rose-300 mb-3">
                              {subject.name}
                            </h3>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-900 dark:text-slate-50">Course:</span>
                                <span className="text-xs text-rose-600 bg-rose-50/60 backdrop-blur-sm px-3 py-1 rounded-full border border-rose-200/60 dark:text-rose-200 dark:bg-rose-900/30 dark:border-rose-700/50">
                                  {subject.course}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-900 dark:text-slate-50">Section:</span>
                                <span className="text-xs text-rose-600 bg-rose-50/60 backdrop-blur-sm px-3 py-1 rounded-full border border-rose-200/60 truncate dark:text-rose-200 dark:bg-rose-900/30 dark:border-rose-700/50">
                                  {subject.section}
                                </span>
                              </div>
                            </div>
                            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-rose-600 dark:group-hover:text-rose-300 transition-colors">
                                View screens →
                              </span>
                              {isLoading && (
                                <svg className="w-4 h-4 text-rose-500 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                </svg>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-12 text-center shadow-xl dark:bg-slate-900/10 dark:border-slate-800/60">
                    <svg
                      className="w-16 h-16 text-slate-300 mx-auto mb-4 dark:text-slate-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    <div className="text-slate-400 text-base font-medium mb-2 dark:text-slate-500">No subjects assigned</div>
                    <div className="text-slate-300 text-sm dark:text-slate-500">
                      You don't have any subjects assigned to you yet. Contact the administrator.
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeSection === 'screen-monitoring' && selectedMonitoringSubject && (
              <ScreenMonitoringSection
                allowedStudentIds={
                  monitoringEnrollmentCache[String(selectedMonitoringSubject.id)]?.studentIds || null
                }
                onBack={handleMonitoringBackToSubjects}
                headerOverride={
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-rose-600 dark:text-rose-300 mb-2">
                      <span className="opacity-60">Screen Monitoring</span>
                      <svg className="w-3 h-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span>Subject</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                        {selectedMonitoringSubject.name}
                      </h3>
                      <span className="text-xs font-mono bg-rose-50/80 backdrop-blur-sm text-rose-700 px-2 py-1 rounded border border-rose-200/60 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800/60">
                        {selectedMonitoringSubject.code}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      {selectedMonitoringSubject.course} · {selectedMonitoringSubject.section} ·{' '}
                      {monitoringEnrollmentCache[String(selectedMonitoringSubject.id)]?.studentIds?.length || 0} enrolled
                    </p>
                  </div>
                }
              />
            )}

            {activeSection === 'live-presentation' && <TeacherPresentationSection subjects={subjects} />}
            {activeSection === 'quizzes' && <TeacherQuizSection subjects={subjects} />}

            {activeSection === 'time-clock' && <StudentsTimeClockSection />}

            {activeSection === 'settings' && user && (
              <StaffDashboardSettings
                role="teacher"
                user={user}
                setUser={setUser}
                onMonitoringPollSaved={(sec) => setMonitoringPollSec(sec)}
              />
            )}

            {/* Enrolled Students Modal */}
            {showStudentsModal && selectedSubject && (
              <div className="fixed inset-0 bg-slate-900/10 dark:bg-slate-950/10 overflow-y-auto h-full w-full z-[100] flex items-center justify-center px-2 py-4 sm:p-4 transition-opacity duration-300" onClick={() => { setShowStudentsModal(false); setSelectedSubject(null); setEnrolledStudents([]); }}>
                <div className="relative bg-white/20 backdrop-blur-xl rounded-2xl shadow-2xl w-11/12 max-w-full sm:max-w-6xl mx-auto max-h-[90vh] flex flex-col transform transition-all duration-300 scale-100 border border-white/20 dark:bg-slate-900/40 dark:border-white/10" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <h3 className="text-2xl font-bold bg-gradient-to-r from-rose-600 to-red-600 bg-clip-text text-transparent dark:from-rose-400 dark:to-red-400">Enrolled Students</h3>
                      <p className="text-sm text-slate-600 mt-1 dark:text-slate-400">Subject: {selectedSubject.name} ({selectedSubject.code}) - {selectedSubject.course} {selectedSubject.section}</p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <button onClick={() => loadAvailableStudentsForSubject(selectedSubject.id)} className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center space-x-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        <span>Add Students</span>
                      </button>
                      <button onClick={() => { setShowStudentsModal(false); setActiveSection('schedule'); }} className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl">
                        Open Schedule
                      </button>
                      <span className="text-sm text-rose-100 bg-gradient-to-r from-rose-500 to-red-600 px-4 py-2 rounded-full font-semibold shadow-inner dark:text-rose-200">{enrolledStudents.length} {enrolledStudents.length === 1 ? 'Student' : 'Students'}</span>
                      <button onClick={() => { setShowStudentsModal(false); setSelectedSubject(null); setEnrolledStudents([]); }} className="text-rose-500 hover:text-red-600 transition-colors duration-300 p-2 hover:bg-rose-50 rounded-lg dark:hover:bg-rose-900/30">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6">
                    {subjectSchedules.length > 0 && (
                      <div className="mb-4 rounded-lg border border-red-200 bg-slate-50/80 p-3 text-xs text-red-800 dark:border-red-700 dark:bg-slate-900/30 dark:text-red-200">
                        Active Schedules: {subjectSchedules.map((s) => `D${s.day_of_week} ${String(s.start_time).slice(0, 5)}-${String(s.end_time).slice(0, 5)} (grace ${s.late_grace_minutes}m)`).join(' | ')}
                      </div>
                    )}
                    {loadingStudents ? (
                      <div className="text-center py-12 text-slate-600 dark:text-slate-400">Loading students...</div>
                    ) : enrolledStudents.length > 0 ? (
                      <div className="overflow-x-auto border border-slate-200 rounded-lg dark:border-slate-800">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                          <thead className="bg-slate-50/10 backdrop-blur-sm sticky top-0 dark:bg-slate-800/10">
                            <tr>
                              <th className="px-6 py-4 text-left text-xs font-medium text-slate-700 uppercase tracking-wider dark:text-slate-300">Photo</th>
                              <th className="px-6 py-4 text-left text-xs font-medium text-slate-700 uppercase tracking-wider dark:text-slate-300">Student Number</th>
                              <th className="px-6 py-4 text-left text-xs font-medium text-slate-700 uppercase tracking-wider dark:text-slate-300">Full Name</th>
                              <th className="px-6 py-4 text-left text-xs font-medium text-slate-700 uppercase tracking-wider dark:text-slate-300">Email</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white/10 backdrop-blur-sm divide-y divide-slate-200/50 dark:bg-slate-900/10 dark:divide-slate-700/50">
                            {enrolledStudents.map((student, idx) => {
                              const profilePicUrl = getProfilePictureUrl(student.profile_picture);
                              return (
                                <tr key={idx} onClick={() => { setSelectedStudent(student); setShowStudentProfile(true); }} className="hover:bg-slate-50/10 backdrop-blur-sm transition-colors duration-150 dark:hover:bg-slate-800/10 cursor-pointer">
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex-shrink-0 h-10 w-10">
                                      {profilePicUrl ? (<img className="h-10 w-10 rounded-full object-cover border-2 border-rose-200 dark:border-rose-700 shadow-sm" src={profilePicUrl} alt={student.full_name || 'Student'} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />) : (<div className="h-10 w-10 rounded-full bg-gradient-to-br from-rose-100 to-red-100 dark:from-rose-900/30 dark:to-red-900/30 border-2 border-rose-200 dark:border-rose-700 flex items-center justify-center shadow-sm"><svg className="h-6 w-6 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></div>)}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800 font-medium dark:text-slate-100">{student.student_number || '-'}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800 dark:text-slate-100">{student.full_name || '-'}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800 dark:text-slate-100 font-semibold">{student.email || '-'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-12 text-center border border-slate-200/60 rounded-2xl bg-white/10 backdrop-blur-sm dark:bg-slate-900/10 dark:border-slate-800/70">
                        <svg className="w-16 h-16 text-slate-300 mx-auto mb-4 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 11a4 4 0 100-8 4 4 0 000 8z" /></svg>
                        <div className="text-slate-400 text-base font-medium mb-2 dark:text-slate-500">No students enrolled</div>
                        <div className="text-slate-300 text-sm dark:text-slate-500">No students are currently enrolled in this subject</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Extracted Modals */}
            <StudentProfileModal
              showStudentProfile={showStudentProfile} selectedStudent={selectedStudent} selectedSubject={selectedSubject}
              getProfilePictureUrl={getProfilePictureUrl} attendanceBreakdown={attendanceBreakdown} attendanceChartGradient={attendanceChartGradient}
              updatingAttendance={updatingAttendance} setUpdatingAttendance={setUpdatingAttendance}
              setEnrolledStudents={setEnrolledStudents} setSelectedStudent={setSelectedStudent}
              setShowStudentProfile={setShowStudentProfile} setAttendanceHistory={setAttendanceHistory} setShowHistoryModal={setShowHistoryModal}
            />

            <EditAttendanceModal
              showEditModal={showEditModal} editingRecord={editingRecord} selectedSubject={selectedSubject} selectedStudent={selectedStudent}
              updatingRecord={updatingRecord} setUpdatingRecord={setUpdatingRecord}
              setShowEditModal={setShowEditModal} setEditingRecord={setEditingRecord}
              setAttendanceHistory={setAttendanceHistory} setEnrolledStudents={setEnrolledStudents} setSelectedStudent={setSelectedStudent}
            />

            <AttendanceHistoryModal
              showHistoryModal={showHistoryModal} selectedSubject={selectedSubject} selectedStudent={selectedStudent}
              loadingHistory={loadingHistory} attendanceHistory={attendanceHistory}
              setShowHistoryModal={setShowHistoryModal} setEditingRecord={setEditingRecord} setShowEditModal={setShowEditModal}
            />

            <BrowserActivityModal
              activityModalOpen={activityModalOpen} currentViewStudent={currentViewStudent}
              studentActivity={studentActivity} setActivityModalOpen={setActivityModalOpen} setStudentActivity={setStudentActivity}
            />
          </div>
        </div>

        {/* Add Students Modal - AT ROOT LEVEL */}
        <AddStudentsModal
          showAddStudentsModal={showAddStudentsModal} selectedSubject={selectedSubject}
          availableStudents={availableStudents} addStudentsTab={addStudentsTab} addStudentsSearchTerm={addStudentsSearchTerm}
          setShowAddStudentsModal={setShowAddStudentsModal} setAddStudentsTab={setAddStudentsTab} setAddStudentsSearchTerm={setAddStudentsSearchTerm}
          groupStudentsBySection={groupStudentsBySection} getProfilePictureUrl={getProfilePictureUrl} enrollStudent={enrollStudent}
        />
      </div>
    </div>
  );
}



