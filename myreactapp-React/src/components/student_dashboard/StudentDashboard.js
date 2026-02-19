import React, { useEffect, useMemo, useRef, useState } from 'react';

import { fetchMe, uploadProfilePicture, deleteProfilePicture, getStudentEnrolledSubjects, getStudentAttendance, updateStudentPin, listSubjects, getSubjectEnrolledStudents, updateStudentProfile } from '../../api/client';


import ThemeToggle from '../../components/ThemeToggle';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://127.0.0.1:8000';

const buildPictureUrl = (picture) => {
  if (!picture) return null;

  // Already a full URL (http:// or https://)
  if (picture.startsWith('http://') || picture.startsWith('https://')) {
    return picture;
  }

  // Relative path starting with /storage/
  if (picture.startsWith('/storage/')) {
    return `${API_BASE}${picture}`;
  }

  // Relative path starting with storage/ (no leading slash)
  if (picture.startsWith('storage/')) {
    return `${API_BASE}/${picture}`;
  }

  // Any other path starting with / (generic fallback)
  if (picture.startsWith('/')) {
    return `${API_BASE}${picture}`;
  }

  // Bare filename or path without leading slash - assume it's in profile_pictures
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

  const fileInputRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetchMe();
        if (mounted && res?.ok) {
          setUser(res.data);
          try {
            localStorage.setItem('user', JSON.stringify(res.data));
          } catch (_) { }
          // Load enrolled subjects as soon as we know the student
          await fetchEnrolledSubjects(res.data);
          return;
        }
      } catch (_) { }

      try {
        const cached = JSON.parse(localStorage.getItem('user'));
        if (mounted && cached) {
          setUser(cached);
          // Also load enrolled subjects when using cached user
          await fetchEnrolledSubjects(cached);
        }
      } catch (_) { }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const studentInfo = useMemo(() => {
    if (!user) return null;
    const fullName = user.full_name || user.fullName || user.name || '';
    return {
      name: fullName,
      studentNumber: user.student_number || user.studentNumber || '',
      email: user.email || '',
      course: user.course || '',
      section: user.section || '',
      profilePicture: user.profile_picture || user.profilePicture || null,
      sectionCourse: (() => {
        const sec = user.section || '';
        const crs = user.course || '';
        const both = [sec, crs].filter(Boolean).join(' / ');
        return both || '';
      })()
    };
  }, [user]);

  useEffect(() => {
    setProfilePictureUrl(buildPictureUrl(studentInfo?.profilePicture || null));
  }, [studentInfo?.profilePicture]);

  useEffect(() => {
    if (activeSection === 'subjects' && user) {
      fetchEnrolledSubjects(user);
    }
  }, [activeSection, user, fetchEnrolledSubjects]);

  const fetchEnrolledSubjects = useCallback(async (currentUser) => {
    setLoadingSubjects(true);
    try {
      const effectiveUser = currentUser || user;

      // --- Primary: use dedicated student endpoint if it returns data ---
      try {
        const res = await getStudentEnrolledSubjects();
        console.log('getStudentEnrolledSubjects response:', res);

        if (res?.ok) {
          const payload = res.data;
          let subjects = [];

          if (Array.isArray(payload)) {
            subjects = payload;
          } else if (Array.isArray(payload?.data)) {
            subjects = payload.data;
          } else if (Array.isArray(payload?.subjects)) {
            subjects = payload.subjects;
          } else if (Array.isArray(payload?.subjects?.data)) {
            subjects = payload.subjects.data;
          }

          if (subjects && subjects.length > 0) {
            const normalized = subjects.map((s) => {
              const subj = s.subject || s;
              return {
                id: subj.id || s.subject_id || s.id,
                code: subj.code || subj.subject_code || s.code,
                name: subj.name || subj.subject_name || s.name,
                course: subj.course || s.course,
                section: subj.section || s.section,
                teacher_name: subj.teacher_name || s.teacher_name || subj.teacher || s.teacher,
                created_at: subj.created_at || s.created_at,
              };
            });
            setEnrolledSubjects(normalized);
            return;
          }
        }
      } catch (e) {
        console.warn('getStudentEnrolledSubjects failed, falling back to subject enrollment scan', e);
      }

      // --- Fallback: derive subjects from all subjects + enrollments (like TeacherDashboard) ---
      if (!effectiveUser) {
        setEnrolledSubjects([]);
        return;
      }

      const courseFilter = effectiveUser.course || null;
      const subjectsRes = await listSubjects(courseFilter);
      const allSubjects = subjectsRes?.ok ? (subjectsRes.data || []) : [];

      const enrolledForStudent = [];
      for (const subj of allSubjects) {
        try {
          const enrolledRes = await getSubjectEnrolledStudents(subj.id);
          if (enrolledRes?.ok) {
            const students = enrolledRes.data || [];
            const isEnrolled = students.some(
              (st) =>
                st.id === effectiveUser.id ||
                st.user_id === effectiveUser.id ||
                st.student_id === effectiveUser.id
            );
            if (isEnrolled) {
              enrolledForStudent.push({
                id: subj.id,
                code: subj.code,
                name: subj.name,
                course: subj.course,
                section: subj.section,
                teacher_name: subj.teacher_name,
                created_at: subj.created_at,
              });
            }
          }
        } catch (e) {
          console.log('Error checking enrollment for subject', subj.id, e);
        }
      }

      setEnrolledSubjects(enrolledForStudent);
    } catch (error) {
      console.error('Failed to fetch enrolled subjects', error);
      setEnrolledSubjects([]);
    } finally {
      setLoadingSubjects(false);
    }
  };

  const fetchAttendance = async (subjectId) => {
    if (attendanceData[subjectId] || loadingAttendance[subjectId]) return;

    setLoadingAttendance((prev) => ({ ...prev, [subjectId]: true }));
    try {
      const res = await getStudentAttendance(subjectId);
      if (res?.ok) {
        setAttendanceData((prev) => ({
          ...prev,
          [subjectId]: res.data?.data || res.data || { present: 0, absent: 0, total: 0, records: [] }
        }));
      }
    } catch (error) {
      console.error('Failed to fetch attendance', error);
      setAttendanceData((prev) => ({
        ...prev,
        [subjectId]: { present: 0, absent: 0, total: 0, records: [], error: true }
      }));
    } finally {
      setLoadingAttendance((prev) => ({ ...prev, [subjectId]: false }));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/';
  };

  const handleProfilePictureUpload = async (file) => {
    setUploadingPicture(true);
    try {
      const res = await uploadProfilePicture(file);
      if (!res?.ok) {
        throw new Error(res?.error || res?.message || 'Failed to upload profile picture');
      }

      const nextPicture =
        res?.data?.data?.profile_picture ||
        res?.data?.profile_picture ||
        res?.data?.profilePicture ||
        res?.data?.path ||
        res?.data?.url ||
        null;

      setUser((prev) => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          profile_picture: nextPicture,
          profilePicture: nextPicture
        };
        try {
          localStorage.setItem('user', JSON.stringify(updated));
        } catch (_) { }
        return updated;
      });

      setProfilePictureUrl(buildPictureUrl(nextPicture));
    } catch (error) {
      console.error('Failed to upload profile picture', error);
      alert(error.message || 'Failed to upload profile picture');
    } finally {
      setUploadingPicture(false);
    }
  };

  const handleDeleteProfilePicture = async () => {
    if (!studentInfo?.profilePicture) return;
    if (!window.confirm('Remove your profile picture?')) return;
    setUploadingPicture(true);
    try {
      const res = await deleteProfilePicture();
      if (!res?.ok) {
        throw new Error(res?.error || res?.message || 'Failed to delete profile picture');
      }

      setUser((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, profile_picture: null, profilePicture: null };
        try {
          localStorage.setItem('user', JSON.stringify(updated));
        } catch (_) { }
        return updated;
      });
      setProfilePictureUrl(null);
    } catch (error) {
      console.error('Failed to delete profile picture', error);
      alert(error.message || 'Failed to delete profile picture');
    } finally {
      setUploadingPicture(false);
    }
  };

  const handleFileSelection = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('File size must be less than 2MB');
      event.target.value = '';
      return;
    }
    await handleProfilePictureUpload(file);
    event.target.value = '';
  };

  const profileFields = useMemo(
    () =>
      infoSkeleton.map((field) => ({
        ...field,
        value: studentInfo?.[field.key] || ''
      })),
    [studentInfo]
  );

  return (
    <div className="h-screen w-full bg-slate-50 dark:bg-slate-900 relative flex overflow-hidden">
      {/* Animated Background Mesh */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-rose-400/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-400/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-1/3 w-96 h-96 bg-violet-400/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>
        <div className="absolute inset-0 bg-grid-slate-200/[0.04] bg-[length:32px_32px] dark:bg-grid-slate-800/[0.04]"></div>
      </div>
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Floating Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50 
        w-80 lg:w-72 lg:h-[95vh] lg:my-auto lg:ml-6
        bg-white/60 backdrop-blur-3xl border border-white/40 shadow-2xl 
        dark:bg-slate-900/60 dark:border-white/10
        lg:rounded-3xl transform transition-all duration-300 ease-in-out 
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-4 lg:p-6 h-full overflow-y-auto">
          <div className="flex items-center justify-between mb-6 lg:mb-8">
            <div className="flex items-center">
              <div className="flex-shrink-0 w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-rose-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg mr-3">
                <svg className="w-5 h-5 lg:w-7 lg:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg lg:text-xl font-bold bg-gradient-to-r from-rose-600 to-red-600 bg-clip-text text-transparent dark:from-rose-400 dark:to-red-400">
                  Student Panel
                </h1>
                <p className="text-xs text-slate-700 dark:text-slate-200 font-medium">Dashboard</p>
              </div>
            </div>
            {/* Close button for mobile */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="space-y-2">
            <button
              onClick={() => setActiveSection('profile')}
              className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 ${activeSection === 'profile'
                ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/50 transform scale-105'
                : 'text-slate-600 hover:bg-gradient-to-r hover:from-rose-50 hover:to-red-50 hover:text-rose-700 dark:text-slate-300 dark:hover:from-rose-900/20 dark:hover:to-red-900/20 dark:hover:text-rose-300'
                }`}
            >
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Profile
            </button>

            <button
              onClick={() => setActiveSection('subjects')}
              className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 ${activeSection === 'subjects'
                ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/50 transform scale-105'
                : 'text-slate-600 hover:bg-gradient-to-r hover:from-rose-50 hover:to-red-50 hover:text-rose-700 dark:text-slate-300 dark:hover:from-rose-900/20 dark:hover:to-red-900/20 dark:hover:text-rose-300'
                }`}
            >
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              My Subject
            </button>

            <button
              onClick={() => {
                setActiveSection('settings');
                // Initialize form with current user data
                if (user) {
                  setSettingsForm({
                    full_name: user.full_name || user.fullName || '',
                    password: '',
                    current_password: ''
                  });
                  setSettingsErrors({});
                  setSettingsSuccess('');
                  setPinError('');
                  setPinSuccess('');
                  setPin('');
                }
              }}
              className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 ${activeSection === 'settings'
                ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/50 transform scale-105'
                : 'text-slate-600 hover:bg-gradient-to-r hover:from-rose-50 hover:to-red-50 hover:text-rose-700 dark:text-slate-300 dark:hover:from-rose-900/20 dark:hover:to-red-900/20 dark:hover:text-rose-300'
                }`}
            >
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </button>
          </nav>
        </div>
      </div>

      {/* Floating Main Content */}
      <div className="flex-1 flex flex-col h-full relative z-10 lg:p-6 overflow-hidden">
        <div className="flex-1 flex flex-col bg-white/40 backdrop-blur-3xl border border-white/30 dark:bg-slate-900/40 dark:border-white/10 shadow-2xl lg:rounded-3xl overflow-hidden">

          {/* Header */}
          <header className="bg-white/50 backdrop-blur-md border-b border-white/20 dark:bg-slate-800/50 dark:border-white/10 sticky top-0 z-40">
            <div className="px-4 lg:px-8 py-4 lg:py-5">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  {/* Mobile Menu Button */}
                  <button
                    onClick={() => setMobileMenuOpen(true)}
                    className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                  <div>
                    <h2 className="text-xl lg:text-3xl font-bold bg-gradient-to-r from-rose-600 to-red-600 bg-clip-text text-transparent dark:from-rose-400 dark:to-red-400">
                      {activeSection === 'profile'
                        ? 'My Profile'
                        : activeSection === 'subjects'
                          ? 'My Subjects'
                          : activeSection === 'settings'
                            ? 'Settings'
                            : 'Student Dashboard'}
                    </h2>
                    <p className="text-xs lg:text-sm text-slate-700 dark:text-slate-200 font-medium mt-1">Student Dashboard</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 lg:space-x-4">
                  <div className="hidden lg:flex items-center space-x-3 bg-gradient-to-r from-rose-50 to-red-50 dark:from-rose-900/30 dark:to-red-900/30 px-4 py-2 rounded-xl">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <div className="text-sm text-slate-900 dark:text-slate-50 font-semibold">
                      Welcome, <span className="font-semibold text-rose-600 dark:text-rose-400">{user?.fullName || user?.full_name || 'Student'}</span>
                    </div>
                  </div>
                  <ThemeToggle />
                  <button
                    onClick={handleLogout}
                    className="bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white px-3 lg:px-5 py-2 lg:py-2.5 rounded-xl text-xs lg:text-sm font-medium transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center space-x-1 lg:space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                </div>
              </div>
            </div>
          </header>

          <div className="flex-1 p-4 lg:p-8 overflow-y-auto relative z-10">
            {activeSection === 'profile' && (
              <div className="max-w-4xl mx-auto">
                <div className="bg-white/40 backdrop-blur-md shadow-2xl rounded-2xl border border-white/20 dark:bg-slate-900/40 dark:border-white/10 overflow-hidden">
                  <div className="p-4 lg:p-8 space-y-6 lg:space-y-8">
                    {!studentInfo ? (
                      <div className="text-center py-12">
                        <div className="w-20 h-20 bg-slate-100/10 backdrop-blur-sm dark:bg-slate-800/10 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 font-medium">No student information found.</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col md:flex-row gap-6 md:items-center pb-6 border-b border-slate-200 dark:border-slate-800">
                          <div className="relative w-24 h-24 flex-shrink-0">
                            {profilePictureUrl ? (
                              <img
                                src={profilePictureUrl}
                                alt="Profile"
                                className="w-24 h-24 rounded-full object-cover border-4 border-rose-200 dark:border-rose-800 shadow-lg"
                                onError={(event) => {
                                  event.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-24 h-24 bg-gradient-to-br from-rose-500 to-red-600 rounded-full flex items-center justify-center shadow-lg text-white">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              </div>
                            )}
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploadingPicture}
                              className="absolute -bottom-2 -right-2 w-9 h-9 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center shadow-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Change profile picture"
                            >
                              {uploadingPicture ? (
                                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                  ></path>
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              )}
                            </button>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/jpeg,image/jpg,image/png"
                              className="hidden"
                              onChange={handleFileSelection}
                            />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-2xl font-semibold text-slate-900 dark:text-white">{studentInfo.name || 'Student'}</h3>
                            <p className="text-sm text-slate-700 dark:text-slate-200 font-medium mt-1">{studentInfo.sectionCourse || 'No course information yet.'}</p>
                            <div className="flex flex-wrap gap-3 mt-4">
                              <button
                                onClick={() => fileInputRef.current?.click()}
                                className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium shadow hover:bg-rose-700 transition-colors"
                              >
                                Change Photo
                              </button>
                              <button
                                onClick={handleDeleteProfilePicture}
                                disabled={uploadingPicture || !studentInfo.profilePicture}
                                className="px-4 py-2 rounded-lg border border-slate-200/80 text-sm font-medium text-slate-800 dark:text-slate-100 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Remove Photo
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          {profileFields.map((field) => (
                            <div
                              key={field.label}
                              className="p-4 rounded-xl bg-slate-50/10 backdrop-blur-sm dark:bg-slate-800/10 border border-slate-200/60 dark:border-slate-800/60 shadow-inner"
                            >
                              <p className="text-xs uppercase tracking-widest text-slate-400">{field.label}</p>
                              <p className="text-lg font-semibold text-slate-900 dark:text-white mt-2">{field.value || 'Not set'}</p>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'subjects' && (
              <div className="max-w-full lg:max-w-6xl mx-auto">
                <div className="bg-white/40 backdrop-blur-md shadow-2xl rounded-2xl border border-white/20 dark:bg-slate-900/40 dark:border-white/10 overflow-hidden">
                  <div className="p-3 sm:p-4 lg:p-8">
                    <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <h3 className="text-2xl font-semibold text-slate-900 dark:text-white mb-1">
                          Enrolled Subjects
                        </h3>
                        <p className="text-sm text-slate-700 dark:text-slate-200 font-medium">
                          View your enrolled subjects and track your attendance
                        </p>
                      </div>
                      <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-rose-50 to-red-50 dark:from-rose-900/30 dark:to-red-900/30 border border-rose-200/60 dark:border-rose-800/60 px-4 py-2 rounded-xl shadow-sm">
                        <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                        <span className="text-sm font-semibold text-rose-700 dark:text-rose-100">
                          {enrolledSubjects.length} Subject{enrolledSubjects.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    {loadingSubjects ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="flex flex-col items-center space-y-3">
                          <svg className="w-10 h-10 animate-spin text-rose-600" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          <p className="text-slate-700 dark:text-slate-200 font-medium text-sm">Loading subjects...</p>
                        </div>
                      </div>
                    ) : enrolledSubjects.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="w-20 h-20 bg-slate-100/10 backdrop-blur-sm dark:bg-slate-800/10 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 font-medium">No enrolled subjects found.</p>
                        <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">You haven't been enrolled in any subjects yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {enrolledSubjects.map((subject) => {
                          const subjectId = subject.id || subject.subject_id;
                          const attendance = attendanceData[subjectId];
                          const isLoadingAtt = loadingAttendance[subjectId];

                          return (
                            <div
                              key={subjectId}
                              className="bg-slate-50/10 backdrop-blur-sm dark:bg-slate-800/10 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-6 hover:shadow-lg transition-shadow"
                            >
                              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-gradient-to-br from-rose-500 to-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                      </svg>
                                    </div>
                                    <div className="flex-1">
                                      <h4 className="text-lg font-semibold text-slate-900 dark:text-white">
                                        {subject.name || subject.subject_name || 'Unnamed Subject'}
                                      </h4>
                                      <div className="flex flex-wrap gap-3 mt-2 text-sm text-slate-600 dark:text-slate-400">
                                        <span className="flex items-center gap-1">
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                          </svg>
                                          Code: <span className="font-medium">{subject.code || subject.subject_code || 'N/A'}</span>
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                          </svg>
                                          Section: <span className="font-medium">{subject.section || 'N/A'}</span>
                                        </span>
                                        {subject.teacher_name && (
                                          <span className="flex items-center gap-1">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                            Teacher: <span className="font-medium">{subject.teacher_name}</span>
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <button
                                  onClick={() => fetchAttendance(subjectId)}
                                  disabled={isLoadingAtt}
                                  className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium shadow hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                  {isLoadingAtt ? (
                                    <>
                                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                      </svg>
                                      Loading...
                                    </>
                                  ) : attendance ? (
                                    'Refresh Attendance'
                                  ) : (
                                    'View Attendance'
                                  )}
                                </button>
                              </div>

                              {attendance && (
                                <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                                  <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-50 font-semibold mb-4">Attendance Summary</h5>
                                  {attendance.error ? (
                                    <p className="text-sm text-red-600 dark:text-red-400">Failed to load attendance data.</p>
                                  ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                      <div className="bg-green-50/40 backdrop-blur-sm dark:bg-green-900/20 border border-green-200/50 dark:border-green-800/50 rounded-lg p-4">
                                        <p className="text-xs uppercase tracking-widest text-green-600 dark:text-green-400 mb-1">Present</p>
                                        <p className="text-2xl font-bold text-green-700 dark:text-green-300">{attendance.present || 0}</p>
                                      </div>
                                      <div className="bg-red-50/40 backdrop-blur-sm dark:bg-red-900/20 border border-red-200/50 dark:border-red-800/50 rounded-lg p-4">
                                        <p className="text-xs uppercase tracking-widest text-red-600 dark:text-red-400 mb-1">Absent</p>
                                        <p className="text-2xl font-bold text-red-700 dark:text-red-300">{attendance.absent || 0}</p>
                                      </div>
                                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                                        <p className="text-xs uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-1">Total Classes</p>
                                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{attendance.total || 0}</p>
                                      </div>
                                    </div>
                                  )}
                                  {attendance.records && attendance.records.length > 0 && (
                                    <div className="mt-4">
                                      <h6 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-widest">Recent Records</h6>
                                      <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {attendance.records.slice(0, 10).map((record, idx) => (
                                          <div
                                            key={idx}
                                            className={`flex items-center justify-between p-2 rounded-lg text-sm ${record.status === 'present'
                                              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                                              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                                              }`}
                                          >
                                            <span className="font-medium">{record.date || record.attendance_date || 'N/A'}</span>
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${record.status === 'present'
                                              ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200'
                                              : 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200'
                                              }`}>
                                              {record.status === 'present' ? 'Present' : 'Absent'}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'settings' && (
              <div className="max-w-4xl mx-auto space-y-6">
                {/* Header Section */}
                <div className="bg-gradient-to-r from-rose-500/20 to-red-500/20 backdrop-blur-sm rounded-2xl border border-rose-200/50 dark:border-rose-800/50 p-6 lg:p-8">
                  <div className="flex items-center space-x-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-rose-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-rose-600 to-red-600 bg-clip-text text-transparent dark:from-rose-400 dark:to-red-400">
                        Settings
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Manage your account preferences and security settings
                      </p>
                    </div>
                  </div>
                </div>

                {/* Profile Information Card */}
                <div className="bg-white/40 backdrop-blur-md shadow-2xl rounded-2xl border border-white/20 dark:bg-slate-900/40 dark:border-white/10 overflow-hidden">
                  <div className="bg-gradient-to-r from-rose-50/50 to-red-50/50 dark:from-rose-900/20 dark:to-red-900/20 border-b border-rose-200/50 dark:border-rose-800/50 px-6 lg:px-8 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-red-600 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Profile Information</h4>
                    </div>
                  </div>
                  <div className="p-6 lg:p-8">
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        setSettingsErrors({});
                        setSettingsSuccess('');

                        // Validation
                        const errors = {};
                        if (!settingsForm.full_name || !settingsForm.full_name.trim()) {
                          errors.full_name = 'Full name is required';
                        }
                        if (settingsForm.password) {
                          if (settingsForm.password.length < 6) {
                            errors.password = 'Password must be at least 6 characters';
                          }
                          if (!settingsForm.current_password) {
                            errors.current_password = 'Current password is required to change password';
                          }
                        }

                        if (Object.keys(errors).length > 0) {
                          setSettingsErrors(errors);
                          return;
                        }

                        setSettingsSaving(true);
                        try {
                          const payload = {
                            full_name: settingsForm.full_name.trim(),
                          };
                          if (settingsForm.password) {
                            payload.password = settingsForm.password;
                            payload.current_password = settingsForm.current_password;
                          }

                          const res = await updateStudentProfile(payload);
                          if (res?.ok) {
                            setSettingsSuccess('Profile updated successfully!');
                            // Refresh user data
                            const userRes = await fetchMe();
                            if (userRes?.ok) {
                              setUser(userRes.data);
                              try {
                                localStorage.setItem('user', JSON.stringify(userRes.data));
                              } catch (_) { }
                            }
                            // Clear password fields
                            setSettingsForm(prev => ({
                              ...prev,
                              password: '',
                              current_password: ''
                            }));
                            setTimeout(() => setSettingsSuccess(''), 3000);
                          } else {
                            setSettingsErrors({ submit: res?.error || 'Failed to update profile' });
                          }
                        } catch (error) {
                          setSettingsErrors({ submit: error.message || 'Failed to update profile' });
                        } finally {
                          setSettingsSaving(false);
                        }
                      }}
                      className="space-y-6"
                    >
                      {/* Full Name */}
                      <div>
                        <label className="flex items-center text-sm font-semibold text-slate-900 dark:text-slate-50 font-semibold mb-2">
                          <svg className="w-4 h-4 mr-2 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          Full Name <span className="text-red-500 ml-1">*</span>
                        </label>
                        <input
                          type="text"
                          value={settingsForm.full_name}
                          onChange={(e) => setSettingsForm(prev => ({ ...prev, full_name: e.target.value }))}
                          className={`w-full px-4 py-3 rounded-xl border-2 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all ${settingsErrors.full_name ? 'border-red-300 bg-red-50/50 dark:bg-red-900/20' : 'border-slate-300 dark:border-slate-700'
                            }`}
                          placeholder="Enter your full name"
                        />
                        {settingsErrors.full_name && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {settingsErrors.full_name}
                          </p>
                        )}
                      </div>

                      {/* Submit Button */}
                      <div className="flex justify-end pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
                        <button
                          type="submit"
                          disabled={settingsSaving}
                          className="px-6 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white text-sm font-semibold shadow-lg shadow-rose-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                        >
                          {settingsSaving ? (
                            <>
                              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <span>Saving...</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span>Save Profile</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                {/* Password Security Card */}
                <div className="bg-white/10 backdrop-blur-sm shadow-2xl rounded-2xl border border-slate-200/50 dark:bg-slate-900/10 dark:border-slate-800/50 overflow-hidden">
                  <div className="bg-gradient-to-r from-rose-50/50 to-red-50/50 dark:from-rose-900/20 dark:to-red-900/20 border-b border-rose-200/50 dark:border-rose-800/50 px-6 lg:px-8 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-red-600 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Password Security</h4>
                    </div>
                  </div>
                  <div className="p-6 lg:p-8">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 flex items-start">
                      <svg className="w-5 h-5 mr-2 text-rose-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Leave password fields empty if you don't want to change your password.
                    </p>

                    <div className="space-y-4">
                      {/* Current Password */}
                      <div>
                        <label className="flex items-center text-sm font-semibold text-slate-900 dark:text-slate-50 font-semibold mb-2">
                          <svg className="w-4 h-4 mr-2 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                          Current Password {settingsForm.password && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <input
                          type="password"
                          value={settingsForm.current_password}
                          onChange={(e) => setSettingsForm(prev => ({ ...prev, current_password: e.target.value }))}
                          className={`w-full px-4 py-3 rounded-xl border-2 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all ${settingsErrors.current_password ? 'border-red-300 bg-red-50/50 dark:bg-red-900/20' : 'border-slate-300 dark:border-slate-700'
                            }`}
                          placeholder="Enter current password"
                        />
                        {settingsErrors.current_password && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {settingsErrors.current_password}
                          </p>
                        )}
                      </div>

                      {/* New Password */}
                      <div>
                        <label className="flex items-center text-sm font-semibold text-slate-900 dark:text-slate-50 font-semibold mb-2">
                          <svg className="w-4 h-4 mr-2 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          New Password
                        </label>
                        <input
                          type="password"
                          value={settingsForm.password}
                          onChange={(e) => setSettingsForm(prev => ({ ...prev, password: e.target.value }))}
                          className={`w-full px-4 py-3 rounded-xl border-2 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all ${settingsErrors.password ? 'border-red-300 bg-red-50/50 dark:bg-red-900/20' : 'border-slate-300 dark:border-slate-700'
                            }`}
                          placeholder="Enter new password (min 6 characters)"
                        />
                        {settingsErrors.password && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {settingsErrors.password}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Security PIN Card */}
                <div className="bg-white/10 backdrop-blur-sm shadow-2xl rounded-2xl border border-slate-200/50 dark:bg-slate-900/10 dark:border-slate-800/50 overflow-hidden">
                  <div className="bg-gradient-to-r from-rose-50/50 to-red-50/50 dark:from-rose-900/20 dark:to-red-900/20 border-b border-rose-200/50 dark:border-rose-800/50 px-6 lg:px-8 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-red-600 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3zm0 2c-2.21 0-4 1.343-4 3v1h8v-1c0-1.657-1.79-3-4-3z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Security PIN</h4>
                        <p className="text-xs text-slate-700 dark:text-slate-200 font-medium">For desktop SMART Card system</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 lg:p-8">
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        setPinError('');
                        setPinSuccess('');
                        if (!/^\d{4}$/.test(pin)) {
                          setPinError('PIN must be exactly 4 digits.');
                          return;
                        }
                        setPinSaving(true);
                        const res = await updateStudentPin(pin);
                        setPinSaving(false);
                        if (!res.ok) {
                          setPinError(res.error || 'Failed to update PIN.');
                        } else {
                          setPinSuccess('PIN updated successfully.');
                          setPin('');
                          setTimeout(() => setPinSuccess(''), 3000);
                        }
                      }}
                      className="space-y-4"
                    >
                      <div>
                        <label className="flex items-center text-sm font-semibold text-slate-900 dark:text-slate-50 font-semibold mb-3">
                          <svg className="w-4 h-4 mr-2 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3zm0 2c-2.21 0-4 1.343-4 3v1h8v-1c0-1.657-1.79-3-4-3z" />
                          </svg>
                          4-Digit PIN
                        </label>
                        <div className="flex items-center space-x-4">
                          <input
                            type="password"
                            value={pin}
                            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            maxLength={4}
                            className="w-40 text-center text-3xl tracking-[0.5em] bg-gradient-to-br from-rose-50 to-red-50 dark:from-slate-800 dark:to-slate-900 border-2 border-rose-300 dark:border-rose-700 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 placeholder:text-slate-400 font-mono"
                            placeholder="••••"
                          />
                          <button
                            type="submit"
                            disabled={pinSaving}
                            className="px-6 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white text-sm font-semibold shadow-lg shadow-rose-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                          >
                            {pinSaving ? (
                              <>
                                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>Saving...</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span>Save PIN</span>
                              </>
                            )}
                          </button>
                        </div>
                        <p className="mt-2 text-xs text-slate-700 dark:text-slate-200 font-medium flex items-center">
                          <svg className="w-4 h-4 mr-1 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Keep this PIN secret. It's used for desktop SMART Card authentication.
                        </p>
                      </div>

                      {pinError && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start">
                          <svg className="w-5 h-5 text-red-600 dark:text-red-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-sm text-red-600 dark:text-red-400">{pinError}</p>
                        </div>
                      )}
                      {pinSuccess && (
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-start">
                          <svg className="w-5 h-5 text-green-600 dark:text-green-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-sm text-green-600 dark:text-green-400">{pinSuccess}</p>
                        </div>
                      )}
                    </form>
                  </div>
                </div>

                {/* Error/Success Messages */}
                {settingsErrors.submit && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start">
                    <svg className="w-5 h-5 text-red-600 dark:text-red-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-red-600 dark:text-red-400">{settingsErrors.submit}</p>
                  </div>
                )}
                {settingsSuccess && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-start">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-green-600 dark:text-green-400">{settingsSuccess}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

