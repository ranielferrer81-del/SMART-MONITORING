import React, { useState, useEffect, useMemo, useRef } from 'react';
import { listSubjects, getSubjectEnrolledStudents, fetchMe, uploadTeacherProfilePicture, deleteTeacherProfilePicture, markStudentAttendance, getStudentAttendanceHistory, updateAttendanceRecord, fetchAllStudentsForTeacher, enrollStudentToSubject } from '../../api/client';
import { getOnlineStudents, getIncognitoAlerts, forceCloseStudentBrowser, getRealtimeBrowserActivity } from '../../api/browserMonitoring';
import ThemeToggle from '../../components/ThemeToggle';

// Browser Monitoring Section Component
const BrowserMonitoringSection = ({ subjects, loadingSubjects, isStudentOnline, hasIncognitoAlert, handleViewActivity }) => {
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const handleSubjectClick = async (subject) => {
    setSelectedSubject(subject);
    setShowStudentsModal(true);
    setLoadingStudents(true);

    try {
      const res = await getSubjectEnrolledStudents(subject.id);
      if (res?.ok) {
        setEnrolledStudents(res.data || []);
      } else {
        setEnrolledStudents([]);
      }
    } catch (e) {
      console.log('Error loading enrolled students:', e);
      setEnrolledStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  };

  return (
    <>
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3 bg-gradient-to-r from-rose-50 to-red-50 dark:from-rose-900/30 dark:to-red-900/30 border border-rose-200/60 dark:border-rose-800/60 px-4 py-2 rounded-xl shadow-md">
            <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
            <span className="text-sm font-semibold text-rose-700 dark:text-rose-100">
              {subjects.length} Subject{subjects.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {loadingSubjects ? (
          <div className="text-center py-12 text-slate-600 dark:text-slate-400">Loading subjects...</div>
        ) : subjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {subjects.map((subject) => (
              <div
                key={subject.id}
                onClick={() => handleSubjectClick(subject)}
                className="group bg-white/40 backdrop-blur-md overflow-hidden shadow-lg rounded-2xl hover:shadow-2xl hover:shadow-rose-500/20 transition-all duration-300 transform hover:-translate-y-1 cursor-pointer border border-white/20 hover:border-rose-300 dark:bg-slate-800/40 dark:border-white/5"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 bg-gradient-to-br from-rose-100 to-red-100 rounded-lg flex items-center justify-center shadow-lg dark:from-rose-900/30 dark:to-red-900/20">
                        <svg className="w-8 h-8 text-rose-600 dark:text-rose-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6l7 2-7 2-7-2 7-2zM5 10l7 2 7-2M5 14l7 2 7-2" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1 ml-4">
                      <h3 className="text-lg font-medium text-slate-800 truncate hover:text-rose-700 transition-colors duration-300 dark:text-slate-100 dark:hover:text-rose-300">{subject.name}</h3>
                      <p className="text-sm text-rose-600 font-mono bg-rose-50/60 backdrop-blur-sm px-2 py-1 rounded dark:text-rose-200 dark:bg-rose-900/30 dark:border dark:border-rose-700">{subject.code}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-900 dark:text-slate-50 font-semibold">Course:</span>
                      <span className="text-xs text-rose-600 bg-rose-50/60 backdrop-blur-sm px-3 py-1 rounded-full border border-rose-200/60 dark:text-rose-200 dark:bg-rose-900/30 dark:border-rose-700/50">{subject.course}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-900 dark:text-slate-50 font-semibold">Section:</span>
                      <span className="text-xs text-rose-600 bg-rose-50/60 backdrop-blur-sm px-3 py-1 rounded-full border border-rose-200/60 truncate dark:text-rose-200 dark:bg-rose-900/30 dark:border-rose-700/50">{subject.section}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-medium dark:text-slate-400">Created</span>
                      <span className="text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded dark:text-slate-400 dark:bg-slate-800">
                        {new Date(subject.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-12 text-center shadow-xl dark:bg-slate-900/10 dark:border-slate-800/60">
            <svg className="w-16 h-16 text-slate-300 mx-auto mb-4 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6l7 2-7 2-7-2 7-2zM5 10l7 2 7-2M5 14l7 2 7-2" />
            </svg>
            <div className="text-slate-400 text-base font-medium mb-2 dark:text-slate-500">No subjects assigned</div>
            <div className="text-slate-300 text-sm dark:text-slate-500">You don't have any subjects assigned to you yet. Contact the administrator.</div>
          </div>
        )}
      </div>

      {/* Students Monitoring Modal */}
      {showStudentsModal && selectedSubject && (
        <div
          className="fixed inset-0 bg-slate-900/10 dark:bg-slate-950/10 overflow-y-auto h-full w-full z-[100] flex items-center justify-center px-2 py-4 sm:p-4 transition-opacity duration-300"
          onClick={() => {
            setShowStudentsModal(false);
            setSelectedSubject(null);
            setEnrolledStudents([]);
          }}
        >
          <div
            className="relative bg-white/20 backdrop-blur-xl rounded-2xl shadow-2xl w-11/12 max-w-full sm:max-w-6xl mx-auto max-h-[90vh] flex flex-col transform transition-all duration-300 scale-100 border border-white/20 dark:bg-slate-900/40 dark:border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-rose-600 to-red-600 bg-clip-text text-transparent dark:from-rose-400 dark:to-red-400">
                  Browser Monitoring
                </h3>
                <p className="text-sm text-slate-600 mt-1 dark:text-slate-400">
                  Subject: {selectedSubject.name} ({selectedSubject.code}) - {selectedSubject.course} {selectedSubject.section}
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-rose-100 bg-gradient-to-r from-rose-500 to-red-600 px-4 py-2 rounded-full font-semibold shadow-inner dark:text-rose-200">
                  {enrolledStudents.length} {enrolledStudents.length === 1 ? 'Student' : 'Students'}
                </span>
                <button
                  onClick={() => {
                    setShowStudentsModal(false);
                    setSelectedSubject(null);
                    setEnrolledStudents([]);
                  }}
                  className="text-rose-500 hover:text-red-600 transition-colors duration-300 p-2 hover:bg-rose-50 rounded-lg dark:hover:bg-rose-900/30"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingStudents ? (
                <div className="text-center py-12 text-slate-600 dark:text-slate-400">Loading students...</div>
              ) : enrolledStudents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {enrolledStudents.map((student) => (
                    <div
                      key={student.id}
                      onClick={() => handleViewActivity(student)}
                      className="group bg-white/40 backdrop-blur-md overflow-hidden shadow-lg rounded-2xl hover:shadow-2xl hover:shadow-indigo-500/20 transition-all duration-300 transform hover:-translate-y-1 cursor-pointer border border-white/20 hover:border-indigo-300 dark:bg-slate-800/40 dark:border-white/5"
                    >
                      <div className="p-6">
                        <div className="flex items-center space-x-4 mb-4">
                          {student.profile_picture ? (
                            <img
                              src={`http://127.0.0.1:8000${student.profile_picture}`}
                              alt={student.full_name || 'Student'}
                              className="w-12 h-12 rounded-full object-cover shadow-lg border-2 border-rose-200 dark:border-rose-700"
                              onError={(e) => {
                                // Fallback to initials if image fails to load
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div
                            className="w-12 h-12 bg-gradient-to-br from-rose-100 to-red-100 rounded-full flex items-center justify-center shadow-lg dark:from-rose-900/30 dark:to-red-900/20"
                            style={{ display: student.profile_picture ? 'none' : 'flex' }}
                          >
                            <span className="text-xl font-bold text-rose-600 dark:text-rose-300">
                              {student.full_name?.charAt(0) || 'S'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-slate-800 truncate dark:text-slate-100">{student.full_name}</h4>
                            <p className="text-xs text-slate-600 truncate dark:text-slate-400">{student.email}</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-600 dark:text-slate-400">Student #:</span>
                            <span className="text-xs font-medium text-slate-800 dark:text-slate-200">{student.student_number || 'N/A'}</span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-600 dark:text-slate-400">Status:</span>
                            {isStudentOnline(student.id) ? (
                              <span className="text-xs font-semibold text-green-600 dark:text-green-400">● Online</span>
                            ) : (
                              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">● Offline</span>
                            )}
                          </div>

                          {hasIncognitoAlert(student.id) && (
                            <div className="mt-2 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
                              <span className="text-xs font-semibold text-red-800 dark:text-red-300 animate-pulse">🚨 Incognito Alert</span>
                            </div>
                          )}
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                          <button className="w-full text-xs text-rose-600 hover:text-rose-700 font-medium dark:text-rose-400 dark:hover:text-rose-300">
                            View Activity →
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-slate-300 mx-auto mb-4 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 11a4 4 0 100-8 4 4 0 000 8z" />
                  </svg>
                  <p className="text-slate-400 dark:text-slate-500">No students enrolled in this subject</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};


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
  const [realtimeActivity, setRealtimeActivity] = useState([]); // NEW: Real-time activity feed
  // Add Student modal states
  const [showAddStudentsModal, setShowAddStudentsModal] = useState(false);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [addStudentsTab, setAddStudentsTab] = useState('bsit');
  const [addStudentsSearchTerm, setAddStudentsSearchTerm] = useState('');
  const fileInputRef = useRef(null);
  const getProfilePictureUrl = (profilePicture) => {
    if (!profilePicture) return null;
    if (typeof profilePicture !== 'string') return null;
    if (profilePicture.startsWith('http')) return profilePicture;
    const apiBase = process.env.REACT_APP_API_BASE || 'http://127.0.0.1:8000';
    if (profilePicture.startsWith('/storage/')) {
      return `${apiBase}${profilePicture}`;
    }
    if (profilePicture.startsWith('storage/')) {
      return `${apiBase}/${profilePicture}`;
    }
    return `${apiBase}/storage/${profilePicture}`;
  };

  // Poll for online students and incognito alerts every 30 seconds
  useEffect(() => {
    const fetchOnlineData = async () => {
      try {
        const [studentsResp, alertsResp, activityResp] = await Promise.all([
          getOnlineStudents(),
          getIncognitoAlerts(),
          getRealtimeBrowserActivity() // NEW: Fetch real-time activity
        ]);

        console.log('👥 Online students response:', studentsResp);
        console.log('🚨 Incognito alerts response:', alertsResp);
        console.log('📊 Real-time activity response:', activityResp);

        if (studentsResp.ok && studentsResp.data) {
          console.log('✅ Setting online students:', studentsResp.data.length);
          setOnlineStudents(Array.isArray(studentsResp.data) ? studentsResp.data : []);
        } else if (Array.isArray(studentsResp)) {
          console.log('✅ Setting online students (direct array):', studentsResp.length);
          setOnlineStudents(studentsResp);
        } else {
          console.warn('⚠️ Unexpected online students format:', studentsResp);
          // Don't clear - keep existing data
        }

        if (alertsResp.ok && alertsResp.data) {
          setIncognitoAlerts(Array.isArray(alertsResp.data) ? alertsResp.data : []);
        } else if (Array.isArray(alertsResp)) {
          setIncognitoAlerts(alertsResp);
        } else {
          console.warn('⚠️ Unexpected alerts format:', alertsResp);
          // Don't clear - keep existing data
        }

        // NEW: Handle real-time activity
        if (activityResp.ok && activityResp.data) {
          console.log('✅ Setting real-time activity:', activityResp.data.length);
          setRealtimeActivity(Array.isArray(activityResp.data) ? activityResp.data : []);
        } else if (Array.isArray(activityResp)) {
          console.log('✅ Setting real-time activity (direct array):', activityResp.length);
          setRealtimeActivity(activityResp);
        } else {
          console.warn('⚠️ Unexpected activity format:', activityResp);
          // Don't clear - keep existing data
        }
      } catch (error) {
        console.error('❌ Failed to fetch online data:', error);
        // Don't clear data - keep existing
      }
    };

    fetchOnlineData();
    const interval = setInterval(fetchOnlineData, 15000); // Poll every 15 seconds (reduced from 5s to improve performance)
    return () => clearInterval(interval);
  }, []);

  const getAttendanceSummary = (student) => {
    if (!student) return { present: 0, late: 0, absent: 0 };
    const attendance = student.attendance_summary;
    if (attendance && typeof attendance === 'object') {
      const present = Number(attendance.present) || 0;
      const late = Number(attendance.late) || 0;
      const absent = Number(attendance.absent) || 0;
      return { present, late, absent };
    }
    // Default when no logs exist yet
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
    ].map((entry) => ({
      ...entry,
      percent: total ? Math.round((entry.value / total) * 100) : 0,
    }));
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
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideIn {
        from { transform: translateY(-20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .animate-fadeIn {
        animation: fadeIn 0.3s ease-out;
      }
      .animate-slideIn {
        animation: slideIn 0.4s ease-out;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Prefer fresh data from API
        const res = await fetchMe();
        console.log('Teacher Dashboard - fetchMe response:', res);
        if (mounted) {
          // Handle both response formats: { ok: true, data: {...} } or direct data
          const userData = res?.ok ? res.data : res;
          console.log('Teacher Dashboard - userData:', userData);
          if (userData) {
            setUser(userData);
            try { localStorage.setItem('user', JSON.stringify(userData)); } catch (_) { }
            return;
          }
        }
      } catch (_) { }
      // Fallback to cached localStorage
      try {
        const userData = JSON.parse(localStorage.getItem('user'));
        if (mounted) setUser(userData);
      } catch (_) { }
    })();
    return () => { mounted = false; };
  }, []);


  useEffect(() => {
    // Load subjects assigned to this teacher
    const loadSubjects = async () => {
      try {
        setLoadingSubjects(true);
        const res = await listSubjects();
        console.log('📚 Subjects API response:', res);

        if (res?.ok && res?.data) {
          console.log('✅ Setting subjects:', res.data.length, 'subjects');
          setSubjects(res.data);
        } else if (res?.ok && Array.isArray(res)) {
          // Handle case where API returns array directly
          console.log('✅ Setting subjects (direct array):', res.length, 'subjects');
          setSubjects(res);
        } else if (Array.isArray(res)) {
          // Handle direct array response without ok wrapper
          console.log('✅ Setting subjects (unwrapped array):', res.length, 'subjects');
          setSubjects(res);
        } else {
          console.warn('⚠️ Unexpected subjects response format:', res);
          // Don't clear subjects - keep existing data
        }
      } catch (e) {
        console.error('❌ Load subjects error:', e);
        // Don't clear subjects - keep existing data
      } finally {
        setLoadingSubjects(false);
      }
    };
    loadSubjects();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/';
  };

  // Browser monitoring helper functions
  const isStudentOnline = (studentId) => {
    return onlineStudents.some(s => s.id === studentId);
  };

  const hasIncognitoAlert = (studentId) => {
    if (!Array.isArray(incognitoAlerts)) return false;
    return incognitoAlerts.some(a => a.student_user_id === studentId && !a.is_acknowledged);
  };

  const handleViewActivity = async (student) => {
    setCurrentViewStudent(student);
    setActivityModalOpen(true);
    setStudentActivity([]); // Clear previous data

    // Fetch browsing history instead of just open tabs
    try {
      const { getStudentBrowserActivity } = await import('../../api/browserMonitoring');
      const resp = await getStudentBrowserActivity(student.id, { per_page: 50 });
      if (resp.ok && resp.data) {
        // Handle paginated response structure
        const historyData = resp.data.data || resp.data || [];
        setStudentActivity(historyData);
      } else {
        setStudentActivity([]);
      }
    } catch (error) {
      console.error('Failed to fetch student browsing history:', error);
      setStudentActivity([]);
    }
  };



  const teacherInfo = useMemo(() => {
    if (!user) return null;
    // Normalize possible field names coming from backend/localStorage
    const fullName = user.full_name || user.fullName || user.name || '';
    return {
      name: fullName,
      email: user.email || '',
      profilePicture: user.profile_picture || user.profilePicture || null,
    };
  }, [user]);

  useEffect(() => {
    if (teacherInfo?.profilePicture) {
      // If profile picture is a relative path, prepend API base URL
      let pictureUrl = teacherInfo.profilePicture;
      if (!pictureUrl.startsWith('http')) {
        // Handle both /storage/ and storage/ paths
        if (pictureUrl.startsWith('/storage/')) {
          pictureUrl = `${process.env.REACT_APP_API_BASE || 'http://127.0.0.1:8000'}${pictureUrl}`;
        } else if (pictureUrl.startsWith('storage/')) {
          pictureUrl = `${process.env.REACT_APP_API_BASE || 'http://127.0.0.1:8000'}/${pictureUrl}`;
        } else {
          pictureUrl = `${process.env.REACT_APP_API_BASE || 'http://127.0.0.1:8000'}/storage/${pictureUrl}`;
        }
      }
      setProfilePictureUrl(pictureUrl);
    } else {
      setProfilePictureUrl(null);
    }
  }, [teacherInfo?.profilePicture]);

  const handleSubjectClick = async (subject) => {
    setSelectedSubject(subject);
    setShowStudentsModal(true);
    setLoadingStudents(true);

    try {
      const res = await getSubjectEnrolledStudents(subject.id);
      if (res?.ok) {
        setEnrolledStudents(res.data || []);
      } else {
        setEnrolledStudents([]);
      }
    } catch (e) {
      console.log('Error loading enrolled students:', e);
      setEnrolledStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  };

  // Helper function to group students by section
  const groupStudentsBySection = (students) => {
    const grouped = {};
    students.forEach(student => {
      const section = student.section || 'No Section';
      if (!grouped[section]) {
        grouped[section] = [];
      }
      grouped[section].push(student);
    });
    return grouped;
  };

  // Load available students for enrollment
  const loadAvailableStudentsForSubject = async (subjectId) => {
    console.log('=== loadAvailableStudentsForSubject CALLED ===');
    console.log('subjectId:', subjectId);
    console.log('subjects:', subjects);

    try {
      const subject = subjects.find(s => s.id === subjectId);
      console.log('Found subject:', subject);

      if (!subject) {
        console.error('Subject not found!');
        return;
      }

      // Load fresh enrolled students from database
      const enrolledRes = await getSubjectEnrolledStudents(subjectId);
      const currentEnrolled = enrolledRes?.ok ? (enrolledRes.data || []) : [];
      console.log('Current enrolled students:', currentEnrolled.length);

      // Update enrolled students state
      setEnrolledStudents(currentEnrolled);

      // Fetch ALL students (not filtered by course or section)
      console.log('Fetching all students...');
      const studentsRes = await fetchAllStudentsForTeacher();
      console.log('fetchAllStudents response:', studentsRes);

      if (studentsRes?.ok) {
        // Filter out already enrolled students only
        const enrolledIds = currentEnrolled.map(s => s.id);
        const available = studentsRes.data.filter(student => !enrolledIds.includes(student.id));
        console.log('Available students:', available.length);

        setAvailableStudents(available);
        setAddStudentsSearchTerm(''); // Reset search when opening modal

        console.log('Setting showAddStudentsModal to TRUE');
        setShowAddStudentsModal(true);
        console.log('=== Modal should now be visible ===');
      } else {
        console.error('Failed to fetch students:', studentsRes);
      }
    } catch (e) {
      console.error('Error in loadAvailableStudentsForSubject:', e);
      setAvailableStudents([]);
    }
  };

  // Enroll a single student
  const enrollStudent = async (student) => {
    if (!selectedSubject) return;

    try {
      const res = await enrollStudentToSubject(selectedSubject.id, student.id);
      if (res?.ok) {
        // Reload enrolled students from database
        const enrolledRes = await getSubjectEnrolledStudents(selectedSubject.id);
        if (enrolledRes?.ok) {
          setEnrolledStudents(enrolledRes.data || []);
        }

        // Remove from available students
        setAvailableStudents(prev => prev.filter(s => s.id !== student.id));

        // Show success alert
        alert(`${student.full_name} has been enrolled successfully!`);
      } else {
        alert(res?.message || 'Failed to enroll student');
      }
    } catch (e) {
      console.log('Enroll student error', e);
      const errorMsg = e?.response?.data?.message || 'Network error';
      alert(errorMsg);
    }
  };

  // Fetch attendance history when history modal is opened
  useEffect(() => {
    if (showHistoryModal && selectedStudent && selectedSubject) {
      setLoadingHistory(true);
      getStudentAttendanceHistory(selectedSubject.id, selectedStudent.id)
        .then((res) => {
          if (res?.ok && res.data?.ok) {
            setAttendanceHistory(res.data.data || []);
          } else {
            setAttendanceHistory([]);
          }
        })
        .catch((err) => {
          console.error('Error fetching attendance history:', err);
          setAttendanceHistory([]);
        })
        .finally(() => {
          setLoadingHistory(false);
        });
    }
  }, [showHistoryModal, selectedStudent, selectedSubject]);

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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 lg:hidden"
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg lg:text-xl font-bold bg-gradient-to-r from-rose-600 to-red-600 bg-clip-text text-transparent dark:from-rose-400 dark:to-red-400">
                  Professor Panel
                </h1>
                <p className="text-xs text-slate-700 dark:text-slate-200 font-medium">Faculty Dashboard</p>
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
              View Profile
            </button>

            <button
              onClick={() => setActiveSection('subjects')}
              className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 ${activeSection === 'subjects'
                ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/50 transform scale-105'
                : 'text-slate-600 hover:bg-gradient-to-r hover:from-rose-50 hover:to-red-50 hover:text-rose-700 dark:text-slate-300 dark:hover:from-rose-900/20 dark:hover:to-red-900/20 dark:hover:text-rose-300'
                }`}
            >
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6l7 2-7 2-7-2 7-2zM5 10l7 2 7-2M5 14l7 2 7-2" />
              </svg>
              My Subjects
            </button>

            <button
              onClick={() => setActiveSection('monitoring')}
              className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 ${activeSection === 'monitoring'
                ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/50 transform scale-105'
                : 'text-slate-600 hover:bg-gradient-to-r hover:from-rose-50 hover:to-red-50 hover:text-rose-700 dark:text-slate-300 dark:hover:from-rose-900/20 dark:hover:to-red-900/20 dark:hover:text-rose-300'
                }`}
            >
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Browser Monitoring
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
                      {activeSection === 'profile' ? 'My Profile' : activeSection === 'subjects' ? 'My Subjects' : activeSection === 'monitoring' ? 'Browser Monitoring' : 'Teacher Dashboard'}
                    </h2>
                    <p className="text-xs lg:text-sm text-slate-700 dark:text-slate-200 font-medium mt-1">
                      {activeSection === 'profile' ? 'View your teacher profile and information' : activeSection === 'subjects' ? 'View and manage the subjects assigned to you' : activeSection === 'monitoring' ? 'Monitor student browser activity in your subjects' : 'Teacher Dashboard'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 lg:space-x-4">
                  <div className="hidden lg:flex items-center space-x-3 bg-gradient-to-r from-rose-50 to-red-50 dark:from-rose-900/30 dark:to-red-900/30 px-4 py-2 rounded-xl">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <div className="text-sm text-slate-900 dark:text-slate-50 font-semibold">
                      Welcome,{' '}
                      <span className="font-semibold text-rose-600 dark:text-rose-400">
                        {user?.full_name || user?.name || 'Professor'}
                      </span>
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
                <div className="bg-white/10 backdrop-blur-sm shadow-2xl rounded-2xl border border-slate-200/50 dark:bg-slate-900/10 dark:border-slate-800/50 overflow-hidden">

                  <div className="p-4 lg:p-8">
                    {!teacherInfo ? (
                      <div className="text-center py-12">
                        <div className="w-20 h-20 bg-slate-100/10 backdrop-blur-sm dark:bg-slate-800/10 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 font-medium">No Professor information found.</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="flex items-center space-x-4 pb-6 border-b border-slate-200 dark:border-slate-800">
                          <div className="relative flex-shrink-0">
                            {profilePictureUrl ? (
                              <div className="relative">
                                <img
                                  src={profilePictureUrl}
                                  alt="Profile"
                                  className="w-20 h-20 rounded-full object-cover border-4 border-rose-200 dark:border-rose-800 shadow-lg"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                                <div className="w-20 h-20 bg-gradient-to-br from-rose-500 to-red-600 rounded-full flex items-center justify-center shadow-lg hidden">
                                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                </div>
                              </div>
                            ) : (
                              <div className="w-20 h-20 bg-gradient-to-br from-rose-500 to-red-600 rounded-full flex items-center justify-center shadow-lg">
                                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              </div>
                            )}
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploadingPicture}
                              className="absolute bottom-0 right-0 w-7 h-7 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center shadow-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Change profile picture"
                            >
                              {uploadingPicture ? (
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;

                                // Validate file size (max 2MB)
                                if (file.size > 2 * 1024 * 1024) {
                                  alert('File size must be less than 2MB');
                                  return;
                                }

                                setUploadingPicture(true);
                                try {
                                  const res = await uploadTeacherProfilePicture(file);
                                  if (res?.ok) {
                                    // Reload user data
                                    const userRes = await fetchMe();
                                    const userData = userRes?.ok ? userRes.data : userRes;
                                    if (userData) {
                                      setUser(userData);
                                      try { localStorage.setItem('user', JSON.stringify(userData)); } catch (_) { }
                                    }
                                  } else {
                                    alert(res?.message || 'Failed to upload profile picture');
                                  }
                                } catch (error) {
                                  console.error('Upload error:', error);
                                  alert('Failed to upload profile picture: ' + (error.response?.data?.message || error.message));
                                } finally {
                                  setUploadingPicture(false);
                                  e.target.value = ''; // Reset input
                                }
                              }}
                            />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{teacherInfo.name || 'Teacher'}</h4>
                            <p className="text-sm text-slate-600 dark:text-slate-400">{teacherInfo.email || '-'}</p>
                            <span className="inline-block mt-2 px-3 py-1 text-xs font-semibold rounded-full bg-indigo-100/40 backdrop-blur-sm text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
                              Professor
                            </span>
                            {profilePictureUrl && (
                              <button
                                onClick={async () => {
                                  if (window.confirm('Are you sure you want to delete your profile picture?')) {
                                    try {
                                      const res = await deleteTeacherProfilePicture();
                                      if (res?.ok) {
                                        const userRes = await fetchMe();
                                        const userData = userRes?.ok ? userRes.data : userRes;
                                        if (userData) {
                                          setUser(userData);
                                          try { localStorage.setItem('user', JSON.stringify(userData)); } catch (_) { }
                                        }
                                      } else {
                                        alert(res?.message || 'Failed to delete profile picture');
                                      }
                                    } catch (error) {
                                      console.error('Delete error:', error);
                                      alert('Failed to delete profile picture: ' + (error.response?.data?.message || error.message));
                                    }
                                  }
                                }}
                                className="mt-2 text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                              >
                                Remove picture
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-900/20 dark:to-indigo-800/10 rounded-xl p-5 border border-indigo-200/50 dark:border-indigo-800/30">
                            <div className="flex items-center space-x-3 mb-2">
                              <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              </div>
                              <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Full Name</div>
                            </div>
                            <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{teacherInfo.name || '-'}</div>
                          </div>

                          <div className="bg-gradient-to-br from-pink-50 to-pink-100/50 dark:from-pink-900/20 dark:to-pink-800/10 rounded-xl p-5 border border-pink-200/50 dark:border-pink-800/30">
                            <div className="flex items-center space-x-3 mb-2">
                              <div className="w-10 h-10 bg-pink-500 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <div className="text-xs font-semibold text-pink-600 dark:text-pink-400 uppercase tracking-wider">Email</div>
                            </div>
                            <div className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate">{teacherInfo.email || '-'}</div>
                          </div>

                          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100/50 dark:from-yellow-900/20 dark:to-yellow-800/10 rounded-xl p-5 border border-yellow-200/50 dark:border-yellow-800/30">
                            <div className="flex items-center space-x-3 mb-2">
                              <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>

                            </div>

                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'subjects' && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3 bg-gradient-to-r from-rose-50 to-red-50 dark:from-rose-900/30 dark:to-red-900/30 border border-rose-200/60 dark:border-rose-800/60 px-4 py-2 rounded-xl shadow-md">
                    <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                    <span className="text-sm font-semibold text-rose-700 dark:text-rose-100">
                      {subjects.length} Subject{subjects.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {loadingSubjects ? (
                  <div className="text-center py-12 text-slate-600 dark:text-slate-400">Loading subjects...</div>
                ) : subjects.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {subjects.map((subject) => (
                      <div
                        key={subject.id}
                        onClick={() => handleSubjectClick(subject)}
                        className="group bg-white/40 backdrop-blur-md overflow-hidden shadow-lg rounded-2xl hover:shadow-2xl hover:shadow-rose-500/20 transition-all duration-300 transform hover:-translate-y-1 cursor-pointer border border-white/20 hover:border-rose-300 dark:bg-slate-800/40 dark:border-white/5"
                      >
                        <div className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex-shrink-0">
                              <div className="w-16 h-16 bg-gradient-to-br from-rose-100 to-red-100 rounded-lg flex items-center justify-center shadow-lg dark:from-rose-900/30 dark:to-red-900/20">
                                <svg className="w-8 h-8 text-rose-600 dark:text-rose-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6l7 2-7 2-7-2 7-2zM5 10l7 2 7-2M5 14l7 2 7-2" />
                                </svg>
                              </div>
                            </div>
                            <div className="flex-1 ml-4">
                              <h3 className="text-lg font-medium text-slate-800 truncate hover:text-rose-700 transition-colors duration-300 dark:text-slate-100 dark:hover:text-rose-300">{subject.name}</h3>
                              <p className="text-sm text-rose-600 font-mono bg-rose-50/60 backdrop-blur-sm px-2 py-1 rounded dark:text-rose-200 dark:bg-rose-900/30 dark:border dark:border-rose-700">{subject.code}</p>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-slate-900 dark:text-slate-50 font-semibold">Course:</span>
                              <span className="text-xs text-rose-600 bg-rose-50/60 backdrop-blur-sm px-3 py-1 rounded-full border border-rose-200/60 dark:text-rose-200 dark:bg-rose-900/30 dark:border-rose-700/50">{subject.course}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-slate-900 dark:text-slate-50 font-semibold">Section:</span>
                              <span className="text-xs text-rose-600 bg-rose-50/60 backdrop-blur-sm px-3 py-1 rounded-full border border-rose-200/60 truncate dark:text-rose-200 dark:bg-rose-900/30 dark:border-rose-700/50">{subject.section}</span>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-500 font-medium dark:text-slate-400">Created</span>
                              <span className="text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded dark:text-slate-400 dark:bg-slate-800">
                                {new Date(subject.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-12 text-center shadow-xl dark:bg-slate-900/10 dark:border-slate-800/60">
                    <svg className="w-16 h-16 text-slate-300 mx-auto mb-4 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6l7 2-7 2-7-2 7-2zM5 10l7 2 7-2M5 14l7 2 7-2" />
                    </svg>
                    <div className="text-slate-400 text-base font-medium mb-2 dark:text-slate-500">No subjects assigned</div>
                    <div className="text-slate-300 text-sm dark:text-slate-500">You don't have any subjects assigned to you yet. Contact the administrator.</div>
                  </div>
                )}
              </div>
            )}

            {/* Browser Monitoring Section */}
            {activeSection === 'monitoring' && (
              <BrowserMonitoringSection
                subjects={subjects}
                loadingSubjects={loadingSubjects}
                isStudentOnline={isStudentOnline}
                hasIncognitoAlert={hasIncognitoAlert}
                handleViewActivity={handleViewActivity}
              />
            )}

            {/* Enrolled Students Modal */}
            {showStudentsModal && selectedSubject && (
              <div
                className="fixed inset-0 bg-slate-900/10 dark:bg-slate-950/10 overflow-y-auto h-full w-full z-[100] flex items-center justify-center px-2 py-4 sm:p-4 transition-opacity duration-300"
                onClick={() => {
                  setShowStudentsModal(false);
                  setSelectedSubject(null);
                  setEnrolledStudents([]);
                }}
              >
                <div
                  className="relative bg-white/20 backdrop-blur-xl rounded-2xl shadow-2xl w-11/12 max-w-full sm:max-w-6xl mx-auto max-h-[90vh] flex flex-col transform transition-all duration-300 scale-100 border border-white/20 dark:bg-slate-900/40 dark:border-white/10"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <h3 className="text-2xl font-bold bg-gradient-to-r from-rose-600 to-red-600 bg-clip-text text-transparent dark:from-rose-400 dark:to-red-400">
                        Enrolled Students
                      </h3>
                      <p className="text-sm text-slate-600 mt-1 dark:text-slate-400">
                        Subject: {selectedSubject.name} ({selectedSubject.code}) - {selectedSubject.course} {selectedSubject.section}
                      </p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={() => loadAvailableStudentsForSubject(selectedSubject.id)}
                        className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center space-x-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        <span>Add Students</span>
                      </button>
                      <span className="text-sm text-rose-100 bg-gradient-to-r from-rose-500 to-red-600 px-4 py-2 rounded-full font-semibold shadow-inner dark:text-rose-200">
                        {enrolledStudents.length} {enrolledStudents.length === 1 ? 'Student' : 'Students'}
                      </span>
                      <button
                        onClick={() => {
                          setShowStudentsModal(false);
                          setSelectedSubject(null);
                          setEnrolledStudents([]);
                        }}
                        className="text-rose-500 hover:text-red-600 transition-colors duration-300 p-2 hover:bg-rose-50 rounded-lg dark:hover:bg-rose-900/30"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Modal Body - Table */}
                  <div className="flex-1 overflow-y-auto p-6">
                    {loadingStudents ? (
                      <div className="text-center py-12 text-slate-600 dark:text-slate-400">Loading students...</div>
                    ) : enrolledStudents.length > 0 ? (
                      <div className="overflow-x-auto border border-slate-200 rounded-lg dark:border-slate-800">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                          <thead className="bg-slate-50/10 backdrop-blur-sm sticky top-0 dark:bg-slate-800/10">
                            <tr>
                              <th className="px-6 py-4 text-left text-xs font-medium text-slate-700 uppercase tracking-wider dark:text-slate-300">
                                Photo
                              </th>
                              <th className="px-6 py-4 text-left text-xs font-medium text-slate-700 uppercase tracking-wider dark:text-slate-300">
                                Student Number
                              </th>
                              <th className="px-6 py-4 text-left text-xs font-medium text-slate-700 uppercase tracking-wider dark:text-slate-300">
                                Full Name
                              </th>
                              <th className="px-6 py-4 text-left text-xs font-medium text-slate-700 uppercase tracking-wider dark:text-slate-300">
                                Email
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white/10 backdrop-blur-sm divide-y divide-slate-200/50 dark:bg-slate-900/10 dark:divide-slate-700/50">
                            {enrolledStudents.map((student, idx) => {
                              const profilePicUrl = getProfilePictureUrl(student.profile_picture);
                              return (
                                <tr
                                  key={idx}
                                  onClick={() => {
                                    setSelectedStudent(student);
                                    setShowStudentProfile(true);
                                  }}
                                  className="hover:bg-slate-50/10 backdrop-blur-sm transition-colors duration-150 dark:hover:bg-slate-800/10 cursor-pointer"
                                >
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex-shrink-0 h-10 w-10">
                                      {profilePicUrl ? (
                                        <img
                                          className="h-10 w-10 rounded-full object-cover border-2 border-rose-200 dark:border-rose-700 shadow-sm"
                                          src={profilePicUrl}
                                          alt={student.full_name || 'Student'}
                                          onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.nextSibling.style.display = 'flex';
                                          }}
                                        />
                                      ) : (
                                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-rose-100 to-red-100 dark:from-rose-900/30 dark:to-red-900/30 border-2 border-rose-200 dark:border-rose-700 flex items-center justify-center shadow-sm">
                                          <svg className="h-6 w-6 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                          </svg>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800 font-medium dark:text-slate-100">
                                    {student.student_number || '-'}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800 dark:text-slate-100">
                                    {student.full_name || '-'}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800 dark:text-slate-100 font-semibold">
                                    {student.email || '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-12 text-center border border-slate-200/60 rounded-2xl bg-white/10 backdrop-blur-sm dark:bg-slate-900/10 dark:border-slate-800/70">
                        <svg className="w-16 h-16 text-slate-300 mx-auto mb-4 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 11a4 4 0 100-8 4 4 0 000 8z" />
                        </svg>
                        <div className="text-slate-400 text-base font-medium mb-2 dark:text-slate-500">No students enrolled</div>
                        <div className="text-slate-300 text-sm dark:text-slate-500">No students are currently enrolled in this subject</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Student Profile Modal */}
            {showStudentProfile && selectedStudent && (
              <div
                className="fixed inset-0 bg-slate-900/10 dark:bg-slate-950/10 overflow-y-auto h-full w-full z-[100] flex items-start justify-center p-4 transition-opacity duration-300 pt-32"
                onClick={() => {
                  setShowStudentProfile(false);
                  setSelectedStudent(null);
                }}
              >
                <div
                  className="relative bg-white/20 backdrop-blur-xl rounded-2xl shadow-2xl w-11/12 max-w-2xl mx-auto max-h-[90vh] flex flex-col transform transition-all duration-300 scale-100 border border-white/20 dark:bg-slate-900/40 dark:border-white/10"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <h3 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-purple-400">
                        Student Profile
                      </h3>
                      <p className="text-sm text-slate-600 mt-1 dark:text-slate-400">
                        View student credentials and information
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setShowStudentProfile(false);
                        setSelectedStudent(null);
                      }}
                      className="text-rose-500 hover:text-red-600 transition-colors duration-300 p-2 hover:bg-rose-50 rounded-lg dark:hover:bg-rose-900/30"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Modal Body - Student Profile */}
                  <div className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-6">
                      {/* Profile Header */}
                      <div className="flex items-center space-x-4 pb-6 border-b border-slate-200 dark:border-slate-700">
                        {getProfilePictureUrl(selectedStudent.profile_picture) ? (
                          <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-rose-200 dark:border-rose-800 shadow-lg">
                            <img
                              className="w-full h-full object-cover"
                              src={getProfilePictureUrl(selectedStudent.profile_picture)}
                              alt={selectedStudent.full_name || 'Student'}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.parentElement.innerHTML = `
                                <div class="w-20 h-20 bg-gradient-to-br from-rose-100 to-red-100 dark:from-rose-900/30 dark:to-red-900/20 rounded-full flex items-center justify-center shadow-lg border-4 border-rose-200 dark:border-rose-800">
                                  <svg class="w-10 h-10 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                </div>
                              `;
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-20 h-20 bg-gradient-to-br from-rose-100 to-red-100 rounded-full flex items-center justify-center shadow-lg border-4 border-rose-200 dark:border-rose-800 dark:from-rose-900/30 dark:to-red-900/20">
                            <svg className="w-10 h-10 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                        )}
                        <div className="flex-1">
                          <h4 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                            {selectedStudent.full_name || 'N/A'}
                          </h4>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            {selectedStudent.email || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <span className={`px-4 py-2 inline-flex text-sm leading-5 font-semibold rounded-full ${selectedStudent.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                            }`}>
                            {selectedStudent.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>

                      {/* Attendance Overview */}
                      <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-6 shadow-sm dark:bg-slate-900/10 dark:border-slate-800/60">
                        <div className="flex items-center justify-between mb-6">
                          <div>
                            <p className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase dark:text-slate-400">Attendance</p>
                            <h4 className="text-xl font-bold text-slate-800 dark:text-slate-100">Engagement Snapshot</h4>
                          </div>
                          <span className="px-3 py-1 text-xs font-medium rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">
                            {attendanceBreakdown.total || 0} Recorded Days
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="flex flex-col items-center justify-center space-y-4">
                            <div className="relative w-48 h-48">
                              <div
                                className="absolute inset-0 rounded-full shadow-lg shadow-indigo-500/10 border border-white/80 dark:border-slate-800"
                                style={{ backgroundImage: attendanceChartGradient }}
                              ></div>
                              <div className="absolute inset-4 bg-white rounded-full flex flex-col items-center justify-center shadow-inner dark:bg-slate-950">
                                <span className="text-xs uppercase tracking-[0.35em] text-slate-700 dark:text-slate-200 font-medium">Present</span>
                                <span className="text-4xl font-bold text-slate-800 dark:text-slate-100">
                                  {attendanceBreakdown.entries?.[0]?.percent || 0}%
                                </span>
                                <span className="text-xs text-slate-700 dark:text-slate-200 font-medium">of total days</span>
                              </div>
                            </div>
                            <div className="text-center text-sm text-slate-700 dark:text-slate-200 font-medium">
                              Visual distribution of Present, Late, and Absent entries. Data shown for illustration purposes.
                            </div>
                          </div>
                          <div className="space-y-4">
                            {attendanceBreakdown.entries?.map((entry) => (
                              <div
                                key={entry.label}
                                className={`p-4 rounded-xl border ${entry.border} bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950`}
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center space-x-3">
                                    <span
                                      className={`h-3 w-3 rounded-full shadow-inner`}
                                      style={{ backgroundColor: entry.color }}
                                    ></span>
                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{entry.label}</p>
                                  </div>
                                  <span className={`text-sm font-semibold ${entry.muted}`}>
                                    {entry.value} day{entry.value === 1 ? '' : 's'} ({entry.percent}%)
                                  </span>
                                </div>
                                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full bg-gradient-to-r ${entry.gradient}`}
                                    style={{ width: `${entry.percent}%` }}
                                  ></div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Manual Attendance Controls */}
                      {selectedSubject && (
                        <div className="bg-white/10 dark:bg-slate-900/10 backdrop-blur-sm rounded-2xl border border-slate-200/70 dark:border-slate-800/70 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase dark:text-slate-400">
                              Manual Attendance
                            </p>
                            <p className="text-sm text-slate-800 dark:text-slate-100 font-semibold">
                              Use these buttons if the QR code is not working or to mark late/absent.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              disabled={updatingAttendance}
                              onClick={async () => {
                                if (!selectedSubject || !selectedStudent) return;
                                setUpdatingAttendance(true);
                                try {
                                  const res = await markStudentAttendance(
                                    selectedSubject.id,
                                    selectedStudent.id,
                                    'present'
                                  );
                                  if (!res?.ok && res?.message) {
                                    alert(res.message);
                                  }
                                  const refreshed = await getSubjectEnrolledStudents(selectedSubject.id);
                                  if (refreshed?.ok) {
                                    const list = refreshed.data || [];
                                    setEnrolledStudents(list);
                                    const updated = list.find((s) => s.id === selectedStudent.id);
                                    if (updated) setSelectedStudent(updated);
                                  }
                                  // Refresh attendance history
                                  const historyRes = await getStudentAttendanceHistory(selectedSubject.id, selectedStudent.id);
                                  if (historyRes?.ok && historyRes.data?.ok) {
                                    setAttendanceHistory(historyRes.data.data || []);
                                  }
                                } catch (err) {
                                  console.error('Manual present error', err);
                                } finally {
                                  setUpdatingAttendance(false);
                                }
                              }}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              Mark Present
                            </button>
                            <button
                              disabled={updatingAttendance}
                              onClick={async () => {
                                if (!selectedSubject || !selectedStudent) return;
                                setUpdatingAttendance(true);
                                try {
                                  const res = await markStudentAttendance(
                                    selectedSubject.id,
                                    selectedStudent.id,
                                    'late'
                                  );
                                  if (!res?.ok && res?.message) {
                                    alert(res.message);
                                  }
                                  const refreshed = await getSubjectEnrolledStudents(selectedSubject.id);
                                  if (refreshed?.ok) {
                                    const list = refreshed.data || [];
                                    setEnrolledStudents(list);
                                    const updated = list.find((s) => s.id === selectedStudent.id);
                                    if (updated) setSelectedStudent(updated);
                                  }
                                  // Refresh attendance history
                                  const historyRes = await getStudentAttendanceHistory(selectedSubject.id, selectedStudent.id);
                                  if (historyRes?.ok && historyRes.data?.ok) {
                                    setAttendanceHistory(historyRes.data.data || []);
                                  }
                                } catch (err) {
                                  console.error('Manual late error', err);
                                } finally {
                                  setUpdatingAttendance(false);
                                }
                              }}
                              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              Mark Late
                            </button>
                            <button
                              disabled={updatingAttendance}
                              onClick={async () => {
                                if (!selectedSubject || !selectedStudent) return;
                                if (!window.confirm('Mark this student as ABSENT for today?')) return;
                                setUpdatingAttendance(true);
                                try {
                                  const res = await markStudentAttendance(
                                    selectedSubject.id,
                                    selectedStudent.id,
                                    'absent'
                                  );
                                  if (!res?.ok && res?.message) {
                                    alert(res.message);
                                  }
                                  const refreshed = await getSubjectEnrolledStudents(selectedSubject.id);
                                  if (refreshed?.ok) {
                                    const list = refreshed.data || [];
                                    setEnrolledStudents(list);
                                    const updated = list.find((s) => s.id === selectedStudent.id);
                                    if (updated) setSelectedStudent(updated);
                                  }
                                  // Refresh attendance history
                                  const historyRes = await getStudentAttendanceHistory(selectedSubject.id, selectedStudent.id);
                                  if (historyRes?.ok && historyRes.data?.ok) {
                                    setAttendanceHistory(historyRes.data.data || []);
                                  }
                                } catch (err) {
                                  console.error('Manual absent error', err);
                                } finally {
                                  setUpdatingAttendance(false);
                                }
                              }}
                              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              Mark Absent
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Student Information */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Student Number */}
                        <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border border-slate-200/50 shadow-sm dark:bg-slate-900/70 dark:border-slate-800/60">
                          <label className="block text-xs font-medium text-slate-600 uppercase tracking-wider mb-2 dark:text-slate-400">
                            Student Number
                          </label>
                          <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                            {selectedStudent.student_number || 'Not assigned'}
                          </p>
                        </div>

                        {/* Course */}
                        <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border border-slate-200/50 shadow-sm dark:bg-slate-900/70 dark:border-slate-800/60">
                          <label className="block text-xs font-medium text-slate-600 uppercase tracking-wider mb-2 dark:text-slate-400">
                            Course
                          </label>
                          <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                            {selectedStudent.course || 'N/A'}
                          </p>
                        </div>
                      </div>

                      {/* Additional Information */}
                      <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border border-slate-200/50 shadow-sm dark:bg-slate-900/70 dark:border-slate-800/60">
                        <label className="block text-xs font-medium text-slate-600 uppercase tracking-wider mb-2 dark:text-slate-400">
                          Email Address
                        </label>
                        <p className="text-base text-slate-800 dark:text-slate-100">
                          {selectedStudent.email || 'N/A'}
                        </p>
                      </div>

                      {/* Attendance History Button */}
                      {selectedSubject && (
                        <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border border-slate-200/50 shadow-sm dark:bg-slate-900/70 dark:border-slate-800/60">
                          <button
                            onClick={() => {
                              setShowHistoryModal(true);
                            }}
                            className="w-full flex items-center justify-center space-x-3 px-6 py-4 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                            <span>View Attendance History</span>
                          </button>
                        </div>
                      )}

                      {/* Subject Information */}
                      {selectedSubject && (
                        <div className="bg-rose-50 rounded-lg p-4 border border-rose-200 dark:bg-rose-900/30 dark:border-rose-700">
                          <label className="block text-xs font-medium text-rose-600 uppercase tracking-wider mb-2 dark:text-rose-400">
                            Enrolled In Subject
                          </label>
                          <p className="text-base font-semibold text-rose-800 dark:text-rose-200">
                            {selectedSubject.name} ({selectedSubject.code})
                          </p>
                          <p className="text-sm text-rose-600 mt-1 dark:text-rose-300">
                            {selectedSubject.course} - {selectedSubject.section}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Edit Attendance Record Modal */}
            {showEditModal && editingRecord && selectedSubject && selectedStudent && (
              <div
                className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/60 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4 transition-opacity duration-300"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingRecord(null);
                }}
              >
                <div
                  className="relative bg-white/10 backdrop-blur-sm rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-100 border border-slate-200/60 dark:bg-slate-900/10 dark:border-slate-800/70"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <h3 className="text-xl font-bold bg-gradient-to-r from-rose-600 to-red-600 bg-clip-text text-transparent dark:from-rose-400 dark:to-red-400">
                        Edit Attendance Record
                      </h3>
                      <p className="text-sm text-slate-600 mt-1 dark:text-slate-400">
                        Change the attendance status for this record
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setShowEditModal(false);
                        setEditingRecord(null);
                      }}
                      className="text-rose-500 hover:text-red-600 transition-colors duration-300 p-2 hover:bg-rose-50 rounded-lg dark:hover:bg-rose-900/30"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-6">
                    <div className="mb-6">
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Date:</p>
                      <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                        {editingRecord.date ? new Date(editingRecord.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        }) : 'N/A'}
                      </p>
                      {editingRecord.scanned_at && (
                        <p className="text-sm text-slate-700 dark:text-slate-200 font-medium mt-1">
                          Scanned at: {new Date(editingRecord.scanned_at).toLocaleString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </p>
                      )}
                    </div>

                    <div className="mb-6">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-50 font-semibold mb-3">Current Status:</p>
                      <div className={`inline-block px-4 py-2 rounded-lg font-semibold ${editingRecord.status === 'present'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                        : editingRecord.status === 'late'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
                        }`}>
                        {editingRecord.status === 'present' ? 'Present' : editingRecord.status === 'late' ? 'Late' : 'Absent'}
                      </div>
                    </div>

                    <div className="mb-6">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-50 font-semibold mb-3">Change Status To:</p>
                      <div className="grid grid-cols-3 gap-3">
                        <button
                          onClick={async () => {
                            if (!selectedSubject || !selectedStudent || !editingRecord) return;
                            setUpdatingRecord(true);
                            try {
                              const res = await updateAttendanceRecord(
                                selectedSubject.id,
                                selectedStudent.id,
                                editingRecord.id,
                                'present'
                              );
                              if (res?.ok) {
                                // Refresh attendance history
                                const historyRes = await getStudentAttendanceHistory(selectedSubject.id, selectedStudent.id);
                                if (historyRes?.ok && historyRes.data?.ok) {
                                  setAttendanceHistory(historyRes.data.data || []);
                                }
                                // Refresh enrolled students to update summary
                                const refreshed = await getSubjectEnrolledStudents(selectedSubject.id);
                                if (refreshed?.ok) {
                                  const list = refreshed.data || [];
                                  setEnrolledStudents(list);
                                  const updated = list.find((s) => s.id === selectedStudent.id);
                                  if (updated) setSelectedStudent(updated);
                                }
                                setShowEditModal(false);
                                setEditingRecord(null);
                              } else {
                                alert(res?.error || 'Failed to update attendance record');
                              }
                            } catch (err) {
                              console.error('Error updating attendance record:', err);
                              alert('Failed to update attendance record');
                            } finally {
                              setUpdatingRecord(false);
                            }
                          }}
                          disabled={updatingRecord || editingRecord.status === 'present'}
                          className={`px-4 py-3 rounded-lg font-semibold text-sm transition-all ${editingRecord.status === 'present'
                            ? 'bg-green-200 text-green-800 cursor-not-allowed opacity-60 dark:bg-green-900/60 dark:text-green-300'
                            : 'bg-green-600 hover:bg-green-700 text-white shadow hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed'
                            }`}
                        >
                          Present
                        </button>
                        <button
                          onClick={async () => {
                            if (!selectedSubject || !selectedStudent || !editingRecord) return;
                            setUpdatingRecord(true);
                            try {
                              const res = await updateAttendanceRecord(
                                selectedSubject.id,
                                selectedStudent.id,
                                editingRecord.id,
                                'late'
                              );
                              if (res?.ok) {
                                // Refresh attendance history
                                const historyRes = await getStudentAttendanceHistory(selectedSubject.id, selectedStudent.id);
                                if (historyRes?.ok && historyRes.data?.ok) {
                                  setAttendanceHistory(historyRes.data.data || []);
                                }
                                // Refresh enrolled students to update summary
                                const refreshed = await getSubjectEnrolledStudents(selectedSubject.id);
                                if (refreshed?.ok) {
                                  const list = refreshed.data || [];
                                  setEnrolledStudents(list);
                                  const updated = list.find((s) => s.id === selectedStudent.id);
                                  if (updated) setSelectedStudent(updated);
                                }
                                setShowEditModal(false);
                                setEditingRecord(null);
                              } else {
                                alert(res?.error || 'Failed to update attendance record');
                              }
                            } catch (err) {
                              console.error('Error updating attendance record:', err);
                              alert('Failed to update attendance record');
                            } finally {
                              setUpdatingRecord(false);
                            }
                          }}
                          disabled={updatingRecord || editingRecord.status === 'late'}
                          className={`px-4 py-3 rounded-lg font-semibold text-sm transition-all ${editingRecord.status === 'late'
                            ? 'bg-amber-200 text-amber-800 cursor-not-allowed opacity-60 dark:bg-amber-900/60 dark:text-amber-300'
                            : 'bg-amber-500 hover:bg-amber-600 text-white shadow hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed'
                            }`}
                        >
                          Late
                        </button>
                        <button
                          onClick={async () => {
                            if (!selectedSubject || !selectedStudent || !editingRecord) return;
                            setUpdatingRecord(true);
                            try {
                              const res = await updateAttendanceRecord(
                                selectedSubject.id,
                                selectedStudent.id,
                                editingRecord.id,
                                'absent'
                              );
                              if (res?.ok) {
                                // Refresh attendance history
                                const historyRes = await getStudentAttendanceHistory(selectedSubject.id, selectedStudent.id);
                                if (historyRes?.ok && historyRes.data?.ok) {
                                  setAttendanceHistory(historyRes.data.data || []);
                                }
                                // Refresh enrolled students to update summary
                                const refreshed = await getSubjectEnrolledStudents(selectedSubject.id);
                                if (refreshed?.ok) {
                                  const list = refreshed.data || [];
                                  setEnrolledStudents(list);
                                  const updated = list.find((s) => s.id === selectedStudent.id);
                                  if (updated) setSelectedStudent(updated);
                                }
                                setShowEditModal(false);
                                setEditingRecord(null);
                              } else {
                                alert(res?.error || 'Failed to update attendance record');
                              }
                            } catch (err) {
                              console.error('Error updating attendance record:', err);
                              alert('Failed to update attendance record');
                            } finally {
                              setUpdatingRecord(false);
                            }
                          }}
                          disabled={updatingRecord || editingRecord.status === 'absent'}
                          className={`px-4 py-3 rounded-lg font-semibold text-sm transition-all ${editingRecord.status === 'absent'
                            ? 'bg-red-200 text-red-800 cursor-not-allowed opacity-60 dark:bg-red-900/60 dark:text-red-300'
                            : 'bg-red-600 hover:bg-red-700 text-white shadow hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed'
                            }`}
                        >
                          Absent
                        </button>
                      </div>
                    </div>

                    {updatingRecord && (
                      <div className="flex items-center justify-center py-2">
                        <svg className="w-5 h-5 animate-spin text-rose-600 dark:text-rose-400 mr-2" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-sm text-slate-600 dark:text-slate-400">Updating...</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Attendance History Modal */}
            {showHistoryModal && selectedSubject && selectedStudent && (
              <div
                className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/60 overflow-y-auto h-full w-full z-[100] flex items-start justify-center p-4 transition-opacity duration-300 pt-32"
                onClick={() => {
                  setShowHistoryModal(false);
                }}
              >
                <div
                  className="relative bg-white/10 backdrop-blur-sm rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col transform transition-all duration-300 scale-100 border border-slate-200/60 dark:bg-slate-900/10 dark:border-slate-800/70"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <h3 className="text-2xl font-bold bg-gradient-to-r from-rose-600 to-red-600 bg-clip-text text-transparent dark:from-rose-400 dark:to-red-400">
                        Attendance History
                      </h3>
                      <p className="text-sm text-slate-600 mt-1 dark:text-slate-400">
                        {selectedStudent.full_name || 'Student'} - {selectedSubject.name} ({selectedSubject.code})
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setShowHistoryModal(false);
                      }}
                      className="text-rose-500 hover:text-red-600 transition-colors duration-300 p-2 hover:bg-rose-50 rounded-lg dark:hover:bg-rose-900/30"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="flex-1 overflow-y-auto p-6">
                    {loadingHistory ? (
                      <div className="flex items-center justify-center py-12">
                        <svg className="w-8 h-8 animate-spin text-rose-600 dark:text-rose-400" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="ml-3 text-base text-slate-600 dark:text-slate-400">Loading history...</span>
                      </div>
                    ) : attendanceHistory.length > 0 ? (
                      <div className="space-y-3">
                        {attendanceHistory.map((record, idx) => (
                          <div
                            key={record.id || idx}
                            onClick={() => {
                              setEditingRecord(record);
                              setShowEditModal(true);
                            }}
                            className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] ${record.status === 'present'
                              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30'
                              : record.status === 'late'
                                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30'
                              }`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center space-x-4 mb-2">
                                <span className={`px-3 py-1.5 text-sm font-semibold rounded-lg ${record.status === 'present'
                                  ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200'
                                  : record.status === 'late'
                                    ? 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200'
                                    : 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200'
                                  }`}>
                                  {record.status === 'present' ? 'Present' : record.status === 'late' ? 'Late' : 'Absent'}
                                </span>
                                <span className="text-base font-semibold text-slate-900 dark:text-slate-50 font-semibold">
                                  {record.date ? new Date(record.date).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  }) : 'N/A'}
                                </span>
                              </div>
                              {record.scanned_at && (
                                <div className="flex items-center space-x-2 text-sm text-slate-700 dark:text-slate-200 font-medium ml-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span>Scanned at: {new Date(record.scanned_at).toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                    hour12: true
                                  })}</span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center space-x-3">
                              <span className="text-xs text-slate-400 dark:text-slate-500 italic">Click to edit</span>
                              <svg className="w-5 h-5 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-slate-400 dark:text-slate-500">
                        <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <p className="text-base font-medium mb-2">No attendance records yet</p>
                        <p className="text-sm">Attendance will appear here after QR code scans</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Browser Activity Modal */}
            {activityModalOpen && currentViewStudent && (
              <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 bg-black/50 backdrop-blur-sm pt-32">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[85vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700">
                  <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-50">
                      Browser Activity for {currentViewStudent.full_name}
                    </h3>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={async () => {
                          if (!window.confirm(`Are you sure you want to close ${currentViewStudent.full_name}'s browser and delete ALL their browsing history?\n\nThis will:\n- Close their entire browser\n- Delete all browsing history from the system\n- Free up database space`)) {
                            return;
                          }
                          try {
                            const result = await forceCloseStudentBrowser(currentViewStudent.id);
                            if (result.ok) {
                              // Clear the activity list from UI
                              setStudentActivity([]);
                              const deletedCount = result.data?.deleted_count || 0;
                              alert(`Success!\n\n- ${deletedCount} history records deleted\n- Browser will close within 30 seconds`);
                            } else {
                              alert('Failed to send exit command: ' + (result.error || 'Unknown error'));
                            }
                          } catch (error) {
                            alert('Error sending exit command: ' + error.message);
                          }
                        }}
                        className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span>Exit Browser</span>
                      </button>
                      <button
                        onClick={() => setActivityModalOpen(false)}
                        className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        title="Close"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-auto p-0">
                    <table className="w-full min-w-max">
                      <thead className="bg-slate-50 dark:bg-slate-900 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-700 sticky top-0">
                        <tr>
                          <th className="px-6 py-3 text-center sticky left-0 bg-slate-50 dark:bg-slate-900 z-10">Actions</th>
                          <th className="px-6 py-3 text-left">Time</th>
                          <th className="px-6 py-3 text-left">URL</th>
                          <th className="px-6 py-3 text-left">Title</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {studentActivity.length > 0 ? (
                          studentActivity.map((log) => (
                            <tr key={log.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${log.is_incognito ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                              <td className="px-6 py-4 text-center sticky left-0 bg-white dark:bg-slate-800 z-10 border-r border-slate-200 dark:border-slate-700">
                                <button
                                  onClick={async () => {
                                    if (!window.confirm(`Close this tab for ${currentViewStudent.full_name}?\n\nURL: ${log.url}\n\nThe tab will close within 5 seconds.`)) {
                                      return;
                                    }
                                    try {
                                      const { forceCloseStudentTab } = await import('../../api/browserMonitoring');
                                      const result = await forceCloseStudentTab(currentViewStudent.id, log.id, log.url);
                                      if (result.ok) {
                                        // Remove from UI immediately for better UX
                                        setStudentActivity(prev => prev.filter(item => item.id !== log.id));
                                        alert('Tab close command sent! The tab will close within 5 seconds.');
                                      } else {
                                        alert('Failed to close tab: ' + (result.error || 'Unknown error'));
                                      }
                                    } catch (error) {
                                      alert('Error closing tab: ' + error.message);
                                    }
                                  }}
                                  className="inline-flex items-center px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-all duration-200 shadow hover:shadow-md transform hover:scale-105"
                                  title="Close this tab on student's browser"
                                >
                                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                  Close
                                </button>
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                {new Date(log.visit_timestamp).toLocaleTimeString()}
                                {log.is_incognito && (
                                  <span className="ml-2 px-1.5 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 rounded text-xs font-semibold">
                                    Incognito
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-sm font-mono truncate max-w-sm" title={log.url}>
                                <a
                                  href={log.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-rose-600 hover:text-rose-700 hover:underline dark:text-rose-400 dark:hover:text-rose-300"
                                >
                                  {log.url}
                                </a>
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 truncate max-w-sm">
                                {log.page_title || 'Untitled'}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                              No browsing history recorded
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Add Students Modal - AT ROOT LEVEL */}
        {showAddStudentsModal && selectedSubject && (
          <div
            className="fixed inset-0 bg-slate-900/30 dark:bg-slate-950/40 overflow-y-auto h-full w-full z-[100] flex items-start justify-center p-4 transition-opacity duration-300 pt-32"
            onClick={() => {
              setShowAddStudentsModal(false);
              setAddStudentsSearchTerm('');
            }}
          >
            <div
              className="relative bg-white/40 backdrop-blur-xl dark:bg-slate-900/40 rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col transform transition-all duration-300 scale-100 border border-slate-200/50 dark:border-slate-800/50"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 lg:p-6 border-b border-slate-200 dark:border-slate-800 gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl lg:text-2xl font-bold text-slate-800 dark:text-slate-100">Add Students</h3>
                  <p className="text-xs lg:text-sm text-slate-600 dark:text-slate-400 mt-1 break-words">
                    Subject: {selectedSubject.name} ({selectedSubject.code}) - {selectedSubject.course} {selectedSubject.section}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowAddStudentsModal(false);
                    setAddStudentsSearchTerm('');
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors duration-300 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Tabs for Courses */}
              <div className="px-4 lg:px-6 pt-4 lg:pt-6 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="bg-white/40 backdrop-blur-xl border border-slate-200/60 rounded-2xl px-3 lg:px-4 py-2 lg:py-3 shadow-lg dark:bg-slate-900/40 dark:border-slate-800/60">
                  <nav className="flex flex-wrap gap-2 lg:gap-3">
                    {[
                      { id: 'bsit', label: 'Students - BSIT' },
                      { id: 'bscs', label: 'Students - BSCS' },
                      { id: 'bsemc', label: 'Students - BSEMC' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setAddStudentsTab(t.id);
                          setAddStudentsSearchTerm('');
                        }}
                        className={`px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg text-xs lg:text-sm font-semibold transition-all duration-300 ${addStudentsTab === t.id
                          ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/40'
                          : 'text-slate-600 hover:text-rose-600 hover:bg-rose-50/80 dark:text-slate-300 dark:hover:bg-rose-900/30'
                          }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </nav>
                </div>
              </div>

              {/* Search Bar */}
              <div className="px-4 lg:px-6 pt-4 lg:pt-6 pb-4">
                <div className="bg-white/40 backdrop-blur-xl border border-slate-200/60 rounded-2xl p-3 lg:p-4 shadow-lg dark:bg-slate-900/40 dark:border-slate-800/60">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Search students by name, email, or student number..."
                      value={addStudentsSearchTerm}
                      onChange={(e) => setAddStudentsSearchTerm(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300/50 rounded-lg leading-5 bg-white/30 backdrop-blur-sm placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-sm dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100 dark:placeholder-slate-400"
                    />
                    {addStudentsSearchTerm && (
                      <button
                        onClick={() => setAddStudentsSearchTerm('')}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        <svg className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {addStudentsSearchTerm && (
                    <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                      Searching for:{' '}
                      <span className="font-medium text-rose-600 dark:text-rose-400">"{addStudentsSearchTerm}"</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-4 lg:p-6">
                {(() => {
                  const courseMap = { bsit: 'BSIT', bscs: 'BSCS', bsemc: 'BSEMC' };
                  const selectedCourse = courseMap[addStudentsTab] || 'BSIT';
                  let courseStudents = availableStudents.filter(student =>
                    (student.course || '').toUpperCase() === selectedCourse
                  );

                  if (addStudentsSearchTerm.trim()) {
                    const searchLower = addStudentsSearchTerm.toLowerCase();
                    courseStudents = courseStudents.filter(student =>
                      student.full_name?.toLowerCase().includes(searchLower) ||
                      student.email?.toLowerCase().includes(searchLower) ||
                      student.student_number?.toLowerCase().includes(searchLower) ||
                      student.section?.toLowerCase().includes(searchLower)
                    );
                  }

                  if (courseStudents.length === 0) {
                    return (
                      <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                        {addStudentsSearchTerm
                          ? `No ${selectedCourse} students found matching "${addStudentsSearchTerm}"`
                          : `No ${selectedCourse} students available for enrollment`}
                      </div>
                    );
                  }

                  const groupedBySection = groupStudentsBySection(courseStudents);

                  return (
                    <div className="space-y-6">
                      {Object.entries(groupedBySection).map(([section, students]) => (
                        <div key={section} className="bg-white shadow-lg rounded-lg border border-gray-200 dark:bg-slate-900/30 dark:border-slate-700/50">
                          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 dark:bg-slate-800 dark:border-slate-700">
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-slate-100">
                              {selectedCourse} - {section} ({students.length} student{students.length !== 1 ? 's' : ''})
                            </h3>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                              <thead className="bg-gray-50/40 backdrop-blur-sm dark:bg-slate-800/40">
                                <tr>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Photo</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Name</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Email</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Student #</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Status</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white/30 backdrop-blur-sm divide-y divide-gray-200/50 dark:bg-slate-900/30 dark:divide-slate-700/50">
                                {students.map((student) => {
                                  const profilePicUrl = getProfilePictureUrl(student.profile_picture);
                                  return (
                                    <tr key={student.id}>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex-shrink-0 h-10 w-10">
                                          {profilePicUrl ? (
                                            <img className="h-10 w-10 rounded-full object-cover border-2 border-rose-200 dark:border-rose-700" src={profilePicUrl} alt={student.full_name || 'Student'} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                                          ) : null}
                                          <div className={`h-10 w-10 rounded-full bg-gradient-to-br from-rose-100 to-red-100 dark:from-rose-900/30 dark:to-red-900/30 border-2 border-rose-200 dark:border-rose-700 flex items-center justify-center ${profilePicUrl ? 'hidden' : 'flex'}`}>
                                            <svg className="h-6 w-6 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-slate-800 dark:text-slate-100">{student.full_name || '-'}</td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-300">{student.email || '-'}</td>
                                      <td className="px-6 py-4 whitespace-nowrap text-slate-800 dark:text-slate-100">{student.student_number || '-'}</td>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${student.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-200'}`}>
                                          {student.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                        <button onClick={() => enrollStudent(student)} className="text-rose-600 hover:text-rose-900 dark:text-rose-400 dark:hover:text-rose-300">Enroll</button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div >

  );
}
