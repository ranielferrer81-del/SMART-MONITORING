import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchMe, uploadProfilePicture, deleteProfilePicture, getStudentEnrolledSubjects, getStudentAttendance, listSubjects, getSubjectEnrolledStudents, getStudentOpenSessions, checkInStudentSubject } from '../../api/client';
import ThemeToggle from '../../components/ThemeToggle';

// Extracted sections
import ProfileSection from './sections/ProfileSection';
import SubjectsSection from './sections/SubjectsSection';
import SettingsSection from './sections/SettingsSection';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://127.0.0.1:8000';

const buildPictureUrl = (picture) => {
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
    if (file.size > 5 * 1024 * 1024) { alert('File size must be less than 5MB'); event.target.value = ''; return; }
    await handleProfilePictureUpload(file);
    event.target.value = '';
  };

  const profileFields = useMemo(() => infoSkeleton.map((field) => ({ ...field, value: studentInfo?.[field.key] || '' })), [studentInfo]);

  return (
    <div className="relative flex h-[100dvh] min-h-0 w-full max-w-[100vw] overflow-hidden bg-slate-50 dark:bg-slate-900">
      {/* Background */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-rose-400/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-400/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-1/3 w-96 h-96 bg-violet-400/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>
        <div className="absolute inset-0 bg-grid-slate-200/[0.04] bg-[length:32px_32px] dark:bg-grid-slate-800/[0.04]"></div>
      </div>
      {mobileMenuOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />}

      {/* Sidebar */}
      <div className={`fixed lg:static inset-y-0 left-0 z-50 w-[min(100vw-2rem,280px)] sm:w-80 lg:w-72 lg:max-h-[95vh] lg:h-[95vh] lg:my-auto lg:ml-6 max-h-[100dvh] overflow-hidden bg-white/60 backdrop-blur-3xl border border-white/40 shadow-2xl dark:bg-slate-900/60 dark:border-white/10 lg:rounded-3xl transform transition-all duration-300 ease-in-out ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-4 lg:p-6 h-full overflow-y-auto">
          <div className="flex items-center justify-between mb-6 lg:mb-8">
            <div className="flex items-center">
              <div className="flex-shrink-0 w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center shadow-lg mr-3 overflow-hidden bg-white/80 dark:bg-slate-800/80 p-1">
                <img src={`${process.env.PUBLIC_URL}/favicon.svg`} alt="" className="w-full h-full object-contain" />
              </div>
              <div><h1 className="text-lg lg:text-xl font-bold bg-gradient-to-r from-rose-600 to-red-600 bg-clip-text text-transparent dark:from-rose-400 dark:to-red-400 tracking-tight">S.M.A.R.T</h1><p className="text-xs text-slate-700 dark:text-slate-200 font-medium">Student Panel</p></div>
            </div>
            <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
          <nav className="space-y-2">
            {[
              { id: 'profile', label: 'Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
              { id: 'subjects', label: 'My Subject', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
              { id: 'settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
            ].map((item) => (
              <button key={item.id} onClick={() => { setMobileMenuOpen(false); setActiveSection(item.id); if (item.id === 'settings' && user) { setSettingsForm({ full_name: user.full_name || user.fullName || '', password: '', current_password: '' }); setSettingsErrors({}); setSettingsSuccess(''); setPinError(''); setPinSuccess(''); setPin(''); } }} className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 ${activeSection === item.id ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/50 transform scale-105' : 'text-slate-600 hover:bg-gradient-to-r hover:from-rose-50 hover:to-red-50 hover:text-rose-700 dark:text-slate-300 dark:hover:from-rose-900/20 dark:hover:to-red-900/20 dark:hover:text-rose-300'}`}>
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} /></svg>
                {item.label}
              </button>
            ))}
            <Link
              to="/student/live-presentation"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 text-slate-600 hover:bg-gradient-to-r hover:from-rose-50 hover:to-red-50 hover:text-rose-700 dark:text-slate-300 dark:hover:from-rose-900/20 dark:hover:to-red-900/20 dark:hover:text-rose-300"
            >
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              Live presentation
            </Link>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative z-10 lg:p-6 overflow-hidden">
        <div className="flex-1 flex flex-col bg-white/40 backdrop-blur-3xl border border-white/30 dark:bg-slate-900/40 dark:border-white/10 shadow-2xl lg:rounded-3xl overflow-hidden">
          <header className="bg-white/50 backdrop-blur-md border-b border-white/20 dark:bg-slate-800/50 dark:border-white/10 sticky top-0 z-40">
            <div className="px-4 lg:px-8 py-4 lg:py-5">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg></button>
                  <div>
                    <h2 className="text-xl lg:text-3xl font-bold bg-gradient-to-r from-rose-600 to-red-600 bg-clip-text text-transparent dark:from-rose-400 dark:to-red-400">{activeSection === 'profile' ? 'My Profile' : activeSection === 'subjects' ? 'My Subjects' : activeSection === 'settings' ? 'Settings' : 'Student Dashboard'}</h2>
                    <p className="text-xs lg:text-sm text-slate-700 dark:text-slate-200 font-medium mt-1">Student Dashboard</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 lg:space-x-4">
                  <div className="hidden lg:flex items-center space-x-3 bg-gradient-to-r from-rose-50 to-red-50 dark:from-rose-900/30 dark:to-red-900/30 px-4 py-2 rounded-xl">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <div className="text-sm text-slate-900 dark:text-slate-50 font-semibold">Welcome, <span className="font-semibold text-rose-600 dark:text-rose-400">{user?.fullName || user?.full_name || 'Student'}</span></div>
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
