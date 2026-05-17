import React, { useState, useEffect, useMemo, useRef } from 'react';
import { listSubjects, getSubjectEnrolledStudents, fetchMe, uploadTeacherProfilePicture, deleteTeacherProfilePicture, getStudentAttendanceHistory, fetchAllStudentsForTeacher, enrollStudentToSubject, saveSubjectSchedules, markStudentAttendance } from '../../api/client';
import { getOnlineStudents, getIncognitoAlerts, getRealtimeBrowserActivity } from '../../api/browserMonitoring';
import ThemeToggle from '../../components/ThemeToggle';

// Extracted components
import BrowserMonitoringSection from './BrowserMonitoringSection';
import TeacherPresentationSection from './TeacherPresentationSection';
import StudentsTimeClockSection from '../StudentsTimeClockSection';
import AttendanceSection from './sections/AttendanceSection';
import ClassScheduleSection from './sections/ClassScheduleSection';
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
  const fileInputRef = useRef(null);
  const alertsPollInitializedRef = useRef(false);
  const seenIncognitoAlertIdsRef = useRef(new Set());
  const [monitoringPollSec, setMonitoringPollSec] = useState(() => getMonitoringPollSeconds());

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
      { label: 'Present', value: stats.present, color: '#22c55e', gradient: 'from-emerald-500 to-emerald-400', border: 'border-emerald-200 dark:border-emerald-500/40', muted: 'text-emerald-600 dark:text-emerald-300' },
      { label: 'Late', value: stats.late, color: '#f97316', gradient: 'from-orange-500 to-amber-400', border: 'border-orange-200 dark:border-orange-500/40', muted: 'text-orange-500 dark:text-orange-300' },
      { label: 'Absent', value: stats.absent, color: '#ef4444', gradient: 'from-rose-500 to-pink-500', border: 'border-rose-200 dark:border-rose-500/40', muted: 'text-rose-500 dark:text-rose-300' },
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
    <div className="relative flex h-[100dvh] min-h-0 w-full max-w-[100vw] overflow-hidden bg-slate-50 dark:bg-slate-900">
      {/* Animated Background Mesh */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-rose-400/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-400/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-1/3 w-96 h-96 bg-violet-400/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>
        <div className="absolute inset-0 bg-grid-slate-200/[0.04] bg-[length:32px_32px] dark:bg-grid-slate-800/[0.04]"></div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Floating Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50 
        w-[min(100vw-2rem,280px)] sm:w-80 lg:w-72 lg:max-h-[95vh] lg:h-[95vh] lg:my-auto lg:ml-6
        max-h-[100dvh] overflow-hidden bg-white/60 backdrop-blur-3xl border border-white/40 shadow-2xl 
        dark:bg-slate-900/60 dark:border-white/10
        lg:rounded-3xl transform transition-all duration-300 ease-in-out 
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-4 lg:p-6 h-full overflow-y-auto">
          <div className="flex items-center justify-between mb-6 lg:mb-8">
            <div className="flex items-center">
              <div className="flex-shrink-0 w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center shadow-lg mr-3 overflow-hidden bg-white/80 dark:bg-slate-800/80 p-1">
                <img src={`${process.env.PUBLIC_URL}/favicon.svg`} alt="" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="text-lg lg:text-xl font-bold bg-gradient-to-r from-rose-600 to-red-600 bg-clip-text text-transparent dark:from-rose-400 dark:to-red-400 tracking-tight">S.M.A.R.T</h1>
                <p className="text-xs text-slate-700 dark:text-slate-200 font-medium">Faculty Dashboard</p>
              </div>
            </div>
            <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <nav className="space-y-2">
            {[
              { id: 'profile', label: 'View Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
              { id: 'subjects', label: 'My Subjects', icon: 'M12 6l7 2-7 2-7-2 7-2zM5 10l7 2 7-2M5 14l7 2 7-2' },
              { id: 'attendance', label: 'Attendance', icon: 'M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z' },
              { id: 'schedule', label: 'Class Schedule', icon: 'M8 7V3m8 4V3m-9 8h10m-11 9h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v11a2 2 0 002 2z' },
              { id: 'monitoring', label: 'Browser Monitoring', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
              { id: 'live-presentation', label: 'Live screen share', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
              { id: 'time-clock', label: 'Students time-in / out', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
              { id: 'settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => { setMobileMenuOpen(false); setActiveSection(item.id); }}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 ${activeSection === item.id
                  ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/50 transform scale-105'
                  : 'text-slate-600 hover:bg-gradient-to-r hover:from-rose-50 hover:to-red-50 hover:text-rose-700 dark:text-slate-300 dark:hover:from-rose-900/20 dark:hover:to-red-900/20 dark:hover:text-rose-300'
                  }`}
              >
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Floating Main Content */}
      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:p-6">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white/40 backdrop-blur-3xl border border-white/30 dark:bg-slate-900/40 dark:border-white/10 shadow-2xl lg:rounded-3xl">

          {/* Header */}
          <header className="bg-white/50 backdrop-blur-md border-b border-white/20 dark:bg-slate-800/50 dark:border-white/10 sticky top-0 z-40">
            <div className="px-4 lg:px-8 py-4 lg:py-5">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                  </button>
                  <div>
                    <h2 className="text-xl lg:text-3xl font-bold bg-gradient-to-r from-rose-600 to-red-600 bg-clip-text text-transparent dark:from-rose-400 dark:to-red-400">
                      {activeSection === 'profile' ? 'My Profile' : activeSection === 'subjects' ? 'My Subjects' : activeSection === 'attendance' ? 'Attendance' : activeSection === 'schedule' ? 'Class Schedule' : activeSection === 'monitoring' ? 'Browser Monitoring' : activeSection === 'live-presentation' ? 'Live screen share' : activeSection === 'time-clock' ? 'Students time-in / time-out' : activeSection === 'settings' ? 'Settings' : 'Professor Dashboard'}
                    </h2>
                    <p className="text-xs lg:text-sm text-slate-700 dark:text-slate-200 font-medium mt-1">
                      {activeSection === 'profile' ? 'View your professor profile and information' : activeSection === 'subjects' ? 'View and manage the subjects assigned to you' : activeSection === 'attendance' ? 'Mark attendance quickly with a dedicated daily workspace' : activeSection === 'schedule' ? 'Set and update class day/time windows for attendance check-in' : activeSection === 'monitoring' ? 'Monitor student browser activity in your subjects' : activeSection === 'live-presentation' ? 'Broadcast your desktop to enrolled students in the browser (WebRTC)' : activeSection === 'time-clock' ? 'PC lab sign-in and sign-out history by course, section, and date' : activeSection === 'settings' ? 'Account, live refresh interval, and incognito alert notifications' : 'Professor Dashboard'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 lg:space-x-4">
                  <div className="hidden lg:flex items-center space-x-3 bg-gradient-to-r from-rose-50 to-red-50 dark:from-rose-900/30 dark:to-red-900/30 px-4 py-2 rounded-xl">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <div className="text-sm text-slate-900 dark:text-slate-50 font-semibold">
                      Welcome,{' '}<span className="font-semibold text-rose-600 dark:text-rose-400">{user?.full_name || user?.name || 'Professor'}</span>
                    </div>
                  </div>
                  <ThemeToggle />
                  <button onClick={handleLogout} className="bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white px-3 lg:px-5 py-2 lg:py-2.5 rounded-xl text-xs lg:text-sm font-medium transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center space-x-1 lg:space-x-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                </div>
              </div>
            </div>
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
                            <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/gif,image/webp" className="hidden" onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > 5 * 1024 * 1024) { alert('File size must be less than 5MB'); return; }
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
                            <span className="inline-block mt-2 px-3 py-1 text-xs font-semibold rounded-full bg-indigo-100/40 backdrop-blur-sm text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">Professor</span>
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
                          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-900/20 dark:to-indigo-800/10 rounded-xl p-5 border border-indigo-200/50 dark:border-indigo-800/30">
                            <div className="flex items-center space-x-3 mb-2">
                              <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center"><svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></div>
                              <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Full Name</div>
                            </div>
                            <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{teacherInfo.name || '-'}</div>
                          </div>
                          <div className="bg-gradient-to-br from-pink-50 to-pink-100/50 dark:from-pink-900/20 dark:to-pink-800/10 rounded-xl p-5 border border-pink-200/50 dark:border-pink-800/30">
                            <div className="flex items-center space-x-3 mb-2">
                              <div className="w-10 h-10 bg-pink-500 rounded-lg flex items-center justify-center"><svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg></div>
                              <div className="text-xs font-semibold text-pink-600 dark:text-pink-400 uppercase tracking-wider">Email</div>
                            </div>
                            <div className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate">{teacherInfo.email || '-'}</div>
                          </div>
                          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100/50 dark:from-yellow-900/20 dark:to-yellow-800/10 rounded-xl p-5 border border-yellow-200/50 dark:border-yellow-800/30">
                            <div className="flex items-center space-x-3 mb-2">
                              <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center"><svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
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

            {activeSection === 'live-presentation' && <TeacherPresentationSection />}

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
                      <button onClick={() => { setShowStudentsModal(false); setActiveSection('schedule'); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl">
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
                      <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50/80 p-3 text-xs text-indigo-800 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200">
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
