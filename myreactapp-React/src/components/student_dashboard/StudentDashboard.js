import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchMe, uploadProfilePicture, deleteProfilePicture, getStudentEnrolledSubjects, getStudentAttendance, listSubjects, getSubjectEnrolledStudents, getStudentOpenSessions, checkInStudentSubject } from '../../api/client';
import ThemeToggle from '../../components/ThemeToggle';

// Extracted sections
import ProfileSection from './sections/ProfileSection';
import SubjectsSection from './sections/SubjectsSection';
import SettingsSection from './sections/SettingsSection';
import { getApiBase } from '../../config/apiBase';

const buildPictureUrl = (picture) => {
  const API_BASE = getApiBase();
  if (!picture) return null;
  if (picture.startsWith('data:')) return picture;
  if (picture.startsWith('http://') || picture.startsWith('https://')) return picture;
  if (picture.startsWith('/storage/')) return `${API_BASE}${picture}`;
  if (picture.startsWith('storage/')) return `${API_BASE}/${picture}`;
  if (picture.startsWith('/')) return `${API_BASE}${picture}`;
  return `${API_BASE}/storage/profile_pictures/${picture}`;
};

const infoSkeleton = [
  { label: 'Full Name', key: 'name' },
  { label: 'Student Number', key: 'studentNumber' },
  { label: 'Email Address', key: 'email' },
  { label: 'Section / Course', key: 'sectionCourse' }
];

export default function StudentDashboard() {
  const [user, setUser] = useState(null);
  const [activeSection, setActiveSection] = useState('profile');
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [profilePictureUrl, setProfilePictureUrl] = useState(null);
  const [enrolledSubjects, setEnrolledSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [attendanceData, setAttendanceData] = useState({});
  const [loadingAttendance, setLoadingAttendance] = useState({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [pinSaving, setPinSaving] = useState(false);
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');
  const [settingsForm, setSettingsForm] = useState({ full_name: '', password: '', current_password: '' });
  const [settingsErrors, setSettingsErrors] = useState({});
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [openSessions, setOpenSessions] = useState([]);
  const [loadingOpenSessions, setLoadingOpenSessions] = useState(false);
  const [checkingInSubjectId, setCheckingInSubjectId] = useState(null);
  const [checkInPin, setCheckInPin] = useState('');
  const [checkInMessage, setCheckInMessage] = useState('');
  const [checkInError, setCheckInError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetchMe();
        if (mounted && res?.ok) {
          setUser(res.data);
          try { localStorage.setItem('user', JSON.stringify(res.data)); } catch (_) { }
          await fetchEnrolledSubjects(res.data);
          return;
        }
      } catch (_) { }
      try {
        const cached = JSON.parse(localStorage.getItem('user'));
        if (mounted && cached) { setUser(cached); await fetchEnrolledSubjects(cached); }
      } catch (_) { }
    })();
    return () => { mounted = false; };
  }, []);

  const studentInfo = useMemo(() => {
    if (!user) return null;
    const fullName = user.full_name || user.fullName || user.name || '';
    return {
      name: fullName, studentNumber: user.student_number || user.studentNumber || '',
      email: user.email || '', course: user.course || '', section: user.section || '',
      profilePicture: user.profile_picture || user.profilePicture || null,
      sectionCourse: [user.section || '', user.course || ''].filter(Boolean).join(' / ') || ''
    };
  }, [user]);

  useEffect(() => { setProfilePictureUrl(buildPictureUrl(studentInfo?.profilePicture || null)); }, [studentInfo?.profilePicture]);

  const fetchEnrolledSubjects = useCallback(async (currentUser) => {
    setLoadingSubjects(true);
    try {
      const effectiveUser = currentUser || user;
      try {
        const res = await getStudentEnrolledSubjects();
        if (res?.ok) {
          const payload = res.data;
          let subjects = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.subjects) ? payload.subjects : Array.isArray(payload?.subjects?.data) ? payload.subjects.data : [];
          if (subjects.length > 0) {
            setEnrolledSubjects(subjects.map((s) => { const subj = s.subject || s; return { id: subj.id || s.subject_id || s.id, code: subj.code || subj.subject_code || s.code, name: subj.name || subj.subject_name || s.name, course: subj.course || s.course, section: subj.section || s.section, teacher_name: subj.teacher_name || s.teacher_name || subj.teacher || s.teacher, created_at: subj.created_at || s.created_at }; }));
            return;
          }
        }
      } catch (e) { console.warn('getStudentEnrolledSubjects failed, falling back', e); }
      if (!effectiveUser) { setEnrolledSubjects([]); return; }
      const subjectsRes = await listSubjects(effectiveUser.course || null);
      const allSubjects = subjectsRes?.ok ? (subjectsRes.data || []) : [];
      const enrolledForStudent = [];
      for (const subj of allSubjects) {
        try {
          const enrolledRes = await getSubjectEnrolledStudents(subj.id);
          if (enrolledRes?.ok) {
            const students = enrolledRes.data || [];
            if (students.some((st) => st.id === effectiveUser.id || st.user_id === effectiveUser.id || st.student_id === effectiveUser.id)) {
              enrolledForStudent.push({ id: subj.id, code: subj.code, name: subj.name, course: subj.course, section: subj.section, teacher_name: subj.teacher_name, created_at: subj.created_at });
            }
          }
        } catch (e) { console.log('Error checking enrollment for subject', subj.id, e); }
      }
      setEnrolledSubjects(enrolledForStudent);
    } catch (error) { console.error('Failed to fetch enrolled subjects', error); setEnrolledSubjects([]); }
    finally { setLoadingSubjects(false); }
  }, [user]);

  useEffect(() => { if (activeSection === 'subjects' && user) fetchEnrolledSubjects(user); }, [activeSection, user, fetchEnrolledSubjects]);

  const fetchOpenSessions = useCallback(async () => {
    setLoadingOpenSessions(true);
    try {
      const res = await getStudentOpenSessions();
      if (res?.ok) {
        const rows = Array.isArray(res.data?.data) ? res.data.data : [];
        setOpenSessions(rows);
      } else {
        setOpenSessions([]);
      }
    } catch (_) {
      setOpenSessions([]);
    } finally {
      setLoadingOpenSessions(false);
    }
  }, []);

  useEffect(() => {
    if (activeSection === 'subjects' && user) {
      fetchOpenSessions();
    }
  }, [activeSection, user, fetchOpenSessions]);

  const handleCheckIn = async (subjectId) => {
    setCheckInMessage('');
    setCheckInError('');
    if (!checkInPin || checkInPin.length !== 4) {
      setCheckInError('Enter your 4-digit PIN first.');
      return;
    }

    setCheckingInSubjectId(subjectId);
    try {
      const res = await checkInStudentSubject(subjectId, checkInPin);
      if (!res?.ok) {
        setCheckInError(res?.error || 'Check-in failed.');
        return;
      }
      setCheckInMessage(res?.data?.message || 'Checked in successfully.');
      await Promise.all([fetchOpenSessions(), fetchEnrolledSubjects(user)]);
      setCheckInPin('');
    } catch (_) {
      setCheckInError('Check-in failed.');
    } finally {
      setCheckingInSubjectId(null);
    }
  };

  const fetchAttendance = async (subjectId) => {
    if (attendanceData[subjectId] || loadingAttendance[subjectId]) return;
    setLoadingAttendance((prev) => ({ ...prev, [subjectId]: true }));
    try {
      const res = await getStudentAttendance(subjectId);
      if (res?.ok) setAttendanceData((prev) => ({ ...prev, [subjectId]: res.data?.data || res.data || { present: 0, absent: 0, total: 0, records: [] } }));
    } catch (error) { setAttendanceData((prev) => ({ ...prev, [subjectId]: { present: 0, absent: 0, total: 0, records: [], error: true } })); }
    finally { setLoadingAttendance((prev) => ({ ...prev, [subjectId]: false })); }
  };

  const handleLogout = () => { localStorage.removeItem('user'); localStorage.removeItem('token'); window.location.href = '/'; };

  const handleProfilePictureUpload = async (file) => {
    setUploadingPicture(true);
    try {
      const res = await uploadProfilePicture(file);
      if (!res?.ok) throw new Error(res?.error || res?.message || 'Failed to upload profile picture');
      const nextPicture = res?.data?.data?.profile_picture || res?.data?.profile_picture || res?.data?.profilePicture || res?.data?.path || res?.data?.url || null;
      setUser((prev) => { if (!prev) return prev; const updated = { ...prev, profile_picture: nextPicture, profilePicture: nextPicture }; try { localStorage.setItem('user', JSON.stringify(updated)); } catch (_) { } return updated; });
      setProfilePictureUrl(buildPictureUrl(nextPicture));
    } catch (error) { alert(error.message || 'Failed to upload profile picture'); }
    finally { setUploadingPicture(false); }
  };

  const handleDeleteProfilePicture = async () => {
    if (!studentInfo?.profilePicture) return;
    if (!window.confirm('Remove your profile picture?')) return;
    setUploadingPicture(true);
    try {
      const res = await deleteProfilePicture();
      if (!res?.ok) throw new Error(res?.error || res?.message || 'Failed to delete profile picture');
      setUser((prev) => { if (!prev) return prev; const updated = { ...prev, profile_picture: null, profilePicture: null }; try { localStorage.setItem('user', JSON.stringify(updated)); } catch (_) { } return updated; });
      setProfilePictureUrl(null);
    } catch (error) { alert(error.message || 'Failed to delete profile picture'); }
    finally { setUploadingPicture(false); }
  };

  const handleFileSelection = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('File size must be less than 2MB'); event.target.value = ''; return; }
    await handleProfilePictureUpload(file);
    event.target.value = '';
  };

  const profileFields = useMemo(() => infoSkeleton.map((field) => ({ ...field, value: studentInfo?.[field.key] || '' })), [studentInfo]);

  return (
    <div className="relative flex h-[100dvh] min-h-0 w-full max-w-[100vw] overflow-hidden">
      {/* Background */}
      <div aria-hidden className="student-aurora pointer-events-none absolute inset-0 -z-10" />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-dotgrid opacity-60" />
        <div className="absolute -top-32 -left-32 h-[30rem] w-[30rem] rounded-full bg-red-400/40 mix-blend-multiply blur-3xl animate-blob" />
        <div className="absolute -top-20 right-0 h-[28rem] w-[28rem] rounded-full bg-rose-400/35 mix-blend-multiply blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute -bottom-32 left-1/3 h-[26rem] w-[26rem] rounded-full bg-slate-400/30 mix-blend-multiply blur-3xl animate-blob animation-delay-4000" />
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
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Student Portal</p>
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
              { id: 'profile',  label: 'Profile',          badgeColor: 'bg-red-50 text-red-500 dark:bg-red-950/40 dark:text-red-400 dark:group-hover:bg-red-900/50 group-hover:bg-red-100', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
              { id: 'subjects', label: 'My Subject',       badgeColor: 'bg-rose-50 text-rose-500 dark:bg-rose-950/40 dark:text-rose-400 dark:group-hover:bg-rose-900/50 group-hover:bg-rose-100',              icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
              { id: 'settings', label: 'Settings',         badgeColor: 'bg-slate-50 text-red-500 dark:bg-slate-950/40 dark:text-red-400 dark:group-hover:bg-slate-900/50 group-hover:bg-slate-100',                icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
            ].map((item) => {
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setActiveSection(item.id);
                    if (item.id === 'settings' && user) {
                      setSettingsForm({ full_name: user.full_name || user.fullName || '', password: '', current_password: '' });
                      setSettingsErrors({}); setSettingsSuccess(''); setPinError(''); setPinSuccess(''); setPin('');
                    }
                  }}
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
            <Link
              to="/student/live-presentation"
              onClick={() => setMobileMenuOpen(false)}
              className="group relative flex w-full items-center rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-300 ease-out overflow-hidden text-slate-700 hover:bg-white/70 hover:text-rose-600 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-rose-300 hover:translate-x-0.5 hover:shadow-soft"
            >
              <span className="mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300 bg-red-50 text-rose-500 dark:bg-red-950/40 dark:text-rose-400 dark:group-hover:bg-red-900/50 group-hover:bg-red-100">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </span>
              <span className="relative z-10 whitespace-nowrap">Live presentation</span>
            </Link>
          </nav>

          {/* Logout Button */}
          <div className="mt-6 lg:mt-8 pt-6 border-t border-slate-200/60 dark:border-slate-700/60">
            <div className="relative group">
              <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-red-500 via-rose-500 to-rose-500 opacity-30 blur-md group-hover:opacity-50 transition-opacity duration-300" aria-hidden />
              <button
                onClick={handleLogout}
                className="relative w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-white rounded-2xl bg-gradient-to-r from-red-500 via-rose-500 to-rose-500 bg-size-200 animate-gradient-shift shadow-[0_8px_24px_-8px_rgba(16,185,129,0.5)] hover:shadow-[0_12px_32px_-8px_rgba(16,185,129,0.7)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 overflow-hidden"
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
                      <span className="hidden h-8 w-1 shrink-0 rounded-full bg-gradient-to-b from-red-500 via-rose-500 to-rose-500 shadow-[0_0_12px_rgba(16,185,129,0.5)] lg:block" aria-hidden />
                      <h2 className="truncate text-xl font-bold tracking-tight text-transparent bg-gradient-to-r from-red-600 via-rose-600 to-rose-600 bg-clip-text dark:from-red-400 dark:via-rose-400 dark:to-rose-400 lg:text-3xl">
                        {activeSection === 'profile' ? 'My Profile' : activeSection === 'subjects' ? 'My Subjects' : activeSection === 'settings' ? 'Settings' : 'Student Dashboard'}
                      </h2>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs font-medium text-slate-700 dark:text-slate-200 lg:text-sm">Student Dashboard</p>
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
                      <span className="font-bold text-red-700 dark:text-red-400">{user?.fullName || user?.full_name || 'Student'}</span>
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
          </header>

          <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 lg:px-8 lg:py-8">
            {activeSection === 'profile' && (
              <ProfileSection studentInfo={studentInfo} profilePictureUrl={profilePictureUrl} profileFields={profileFields} uploadingPicture={uploadingPicture} fileInputRef={fileInputRef} handleFileSelection={handleFileSelection} handleDeleteProfilePicture={handleDeleteProfilePicture} />
            )}
            {activeSection === 'subjects' && (
              <SubjectsSection
                enrolledSubjects={enrolledSubjects}
                loadingSubjects={loadingSubjects}
                attendanceData={attendanceData}
                loadingAttendance={loadingAttendance}
                fetchAttendance={fetchAttendance}
                openSessions={openSessions}
                loadingOpenSessions={loadingOpenSessions}
                checkInPin={checkInPin}
                setCheckInPin={setCheckInPin}
                checkInMessage={checkInMessage}
                checkInError={checkInError}
                checkingInSubjectId={checkingInSubjectId}
                handleCheckIn={handleCheckIn}
              />
            )}
            {activeSection === 'settings' && (
              <SettingsSection user={user} setUser={setUser} settingsForm={settingsForm} setSettingsForm={setSettingsForm} settingsErrors={settingsErrors} setSettingsErrors={setSettingsErrors} settingsSaving={settingsSaving} setSettingsSaving={setSettingsSaving} settingsSuccess={settingsSuccess} setSettingsSuccess={setSettingsSuccess} pin={pin} setPin={setPin} pinSaving={pinSaving} setPinSaving={setPinSaving} pinError={pinError} setPinError={setPinError} pinSuccess={pinSuccess} setPinSuccess={setPinSuccess} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


