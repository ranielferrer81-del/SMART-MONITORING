import React, { useState, useEffect } from 'react';
import { createAccount, fetchTeachers, fetchAllStudents, fetchStudentsByCourse, updateAccount, deleteAccount, listSubjects, createSubject, deleteSubject, getSubjectEnrolledStudents, enrollStudentToSubject, enrollAllStudentsToSubject, unenrollStudentFromSubject } from '../../api/client';
import { getStudentBrowserActivity, getRealtimeBrowserActivity, getIncognitoAlerts, acknowledgeIncognitoAlert, startMonitoringSession, endMonitoringSession, getMonitoringSessions } from '../../api/browserMonitoring';
import ThemeToggle from '../../components/ThemeToggle';
import BrowserMonitoringDashboard from '../BrowserMonitoringDashboard';

export default function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('teachers');
  const [teachers, setTeachers] = useState([]);
  const [studentsBSIT, setStudentsBSIT] = useState([]);
  const [studentsBSCS, setStudentsBSCS] = useState([]);
  const [studentsBSEMC, setStudentsBSEMC] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' }); // type: 'success' or 'error'
  const [form, setForm] = useState({ role: 'student', full_name: '', email: '', password: '', course: '', section: '', student_number: '' });
  const [formErrors, setFormErrors] = useState({});
  const [editUser, setEditUser] = useState(null);
  const [activeSection, setActiveSection] = useState('accounts');

  const [subjects, setSubjects] = useState([]);
  const [newSubject, setNewSubject] = useState({ code: '', name: '', course: '', section: '', teacher_user_id: '' });
  const [subErrors, setSubErrors] = useState({});
  const [enrolledStudents, setEnrolledStudents] = useState({}); // Store enrolled students for each subject
  const [showStudentsModal, setShowStudentsModal] = useState(null); // Track which subject's students modal is open
  const [showAddStudentsModal, setShowAddStudentsModal] = useState(false); // Track if add students modal is open
  const [availableStudents, setAvailableStudents] = useState([]); // Store available students for enrollment
  const [addStudentsTab, setAddStudentsTab] = useState('bsit'); // Tab for Add Students modal (bsit, bscs, bsemc)
  const [addStudentsSearchTerm, setAddStudentsSearchTerm] = useState(''); // Search term for Add Students modal
  const [searchTerm, setSearchTerm] = useState(''); // Search term for filtering accounts
  const [customSections, setCustomSections] = useState({ BSIT: [], BSCS: [], BSEMC: [] });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // Mobile menu toggle state
  const [newSection, setNewSection] = useState({ section: '' });

  useEffect(() => {
    try {
      const userData = JSON.parse(localStorage.getItem('user'));
      setUser(userData);
      // Load all data when component mounts
      loadAllLists();
      loadSubjects();
      // load custom sections
      const savedSections = JSON.parse(localStorage.getItem('customSections'));
      if (savedSections && typeof savedSections === 'object') {
        setCustomSections({ BSIT: savedSections.BSIT || [], BSCS: savedSections.BSCS || [], BSEMC: savedSections.BSEMC || [] });
      }
    } catch (_) { }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('customSections', JSON.stringify(customSections));
    } catch (_) { }
  }, [customSections]);

  // Load enrolled students when modal opens
  useEffect(() => {
    if (showStudentsModal) {
      const loadEnrolled = async () => {
        try {
          const res = await getSubjectEnrolledStudents(showStudentsModal);
          if (res?.ok) {
            setEnrolledStudents(prev => ({
              ...prev,
              [showStudentsModal]: res.data || []
            }));
          }
        } catch (e) {
          console.log('Error loading enrolled students:', e);
        }
      };
      loadEnrolled();
    }
  }, [showStudentsModal]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/';
  };



  const handleDeleteAccount = async (accountId) => {
    if (!window.confirm('Are you sure you want to delete this account?')) return;
    try {
      setLoading(true);
      const res = await deleteAccount(accountId);
      if (res?.ok) {
        await loadAllLists();
      } else {
        alert(res?.message || 'Failed to delete');
      }
    } catch (e) {
      console.log('Delete error', e);
      alert('Network error');
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (u) => {
    // Ensure role is set correctly - students have course field, teachers have department
    let role = u.role;
    if (!role) {
      if (u.course || u.student_number) {
        role = 'student';
      } else if (u.department || u.teacher_number) {
        role = 'teacher';
      } else {
        role = 'admin';
      }
    }
    // Store original course to detect changes later - ensure it's properly captured
    // Use null if course is undefined/null/empty to ensure proper comparison
    const originalCourse = u.course && u.course.trim() ? u.course.trim() : null;
    setEditUser({
      ...u,
      role,
      _originalCourse: originalCourse,
      // Ensure course is properly set for students
      course: role === 'student' ? (u.course && u.course.trim() ? u.course.trim() : '') : u.course
    });
  };

  const saveEdit = async () => {
    if (!editUser) return;
    try {
      setLoading(true);

      // Track original course for students to detect course changes
      const originalCourse = (editUser._originalCourse && editUser._originalCourse.trim()) || null;
      const isStudent = editUser.role === 'student' || editUser.course !== undefined || editUser.student_number;

      // Normalize the new course value
      let newCourse = null;
      if (editUser.course !== undefined && editUser.course !== null) {
        if (typeof editUser.course === 'string') {
          newCourse = editUser.course.trim() || null;
        } else {
          newCourse = editUser.course;
        }
      }

      // Uppercase if it's a valid course
      if (newCourse && ['BSIT', 'BSCS', 'BSEMC'].includes(newCourse.toUpperCase())) {
        newCourse = newCourse.toUpperCase();
      }

      const courseChanged = isStudent && newCourse !== originalCourse;

      const payload = {};
      ['full_name', 'email', 'is_active', 'section', 'student_number', 'department', 'specialization'].forEach((k) => {
        if (editUser[k] !== undefined) payload[k] = editUser[k];
      });

      // For students, ALWAYS send course when it's defined to ensure persistence
      // This is the critical fix - we must explicitly send course changes to the backend
      if (isStudent && editUser.course !== undefined) {
        // Send the normalized course value (or null if cleared)
        payload.course = newCourse;
      }

      const res = await updateAccount(editUser.id, payload);
      if (res?.ok) {
        // If course changed, reload all lists to move student to new course table
        if (courseChanged) {
          // Reload all course lists - this will fetch fresh data from backend
          // Student will appear in new course table and disappear from old one
          await loadAllLists();
          setToast({ show: true, message: `Student moved to ${newCourse} course successfully!`, type: 'success' });
        } else {
          // Just reload for other updates
          await loadAllLists();
          setToast({ show: true, message: 'Account updated successfully!', type: 'success' });
        }
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 2500);
        setEditUser(null);
      } else {
        setToast({ show: true, message: res?.message || 'Failed to update account', type: 'error' });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
      }
    } catch (e) {
      console.log('Update error', e);
      const errorMsg = e?.response?.data?.message || 'Network error. Please try again.';
      setToast({ show: true, message: errorMsg, type: 'error' });
      setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
    } finally {
      setLoading(false);
    }
  };

  const loadAllLists = async (forceRefresh = false) => {
    try {
      console.log('🔄 Starting loadAllLists...', forceRefresh ? '(FORCE REFRESH)' : '');
      setLoading(true);

      // If force refresh, clear all data first
      if (forceRefresh) {
        console.log('🧹 Clearing all data for force refresh...');
        setTeachers([]);
        setStudentsBSIT([]);
        setStudentsBSCS([]);
        setStudentsBSEMC([]);
      }

      const [t, b1, b2, b3] = await Promise.all([
        fetchTeachers().catch(e => {
          console.error('❌ Error fetching teachers:', e);
          return { ok: false, data: [] };
        }),
        fetchStudentsByCourse('BSIT').catch(e => {
          console.error('❌ Error fetching BSIT students:', e);
          return { ok: false, data: [] };
        }),
        fetchStudentsByCourse('BSCS').catch(e => {
          console.error('❌ Error fetching BSCS students:', e);
          return { ok: false, data: [] };
        }),
        fetchStudentsByCourse('BSEMC').catch(e => {
          console.error('❌ Error fetching BSEMC students:', e);
          return { ok: false, data: [] };
        }),
      ]);

      // Backend returns { ok: true, data: [...] }, so res.data is { ok: true, data: [...] }
      console.log('📊 Teachers response:', t);
      if (t && t.ok && t.data) {
        const teachersData = Array.isArray(t.data) ? t.data : [];
        console.log('✅ Setting teachers:', teachersData.length, 'teachers');
        setTeachers(teachersData);
      } else if (Array.isArray(t)) {
        console.log('✅ Setting teachers (direct array):', t.length, 'teachers');
        setTeachers(t);
      } else {
        console.warn('⚠️ Teachers fetch failed or returned no data');
        // Don't clear teachers - keep existing data
      }

      console.log('📊 BSIT response:', b1);
      if (b1 && b1.ok && b1.data) {
        const bsitData = Array.isArray(b1.data) ? b1.data : [];
        console.log('✅ Setting BSIT students:', bsitData.length);
        setStudentsBSIT(bsitData);
      } else if (Array.isArray(b1)) {
        console.log('✅ Setting BSIT students (direct array):', b1.length);
        setStudentsBSIT(b1);
      } else {
        console.warn('⚠️ No BSIT data or ok=false');
        setStudentsBSIT([]);
      }

      console.log('📊 BSCS response:', b2);
      if (b2 && b2.ok && b2.data) {
        const bscsData = Array.isArray(b2.data) ? b2.data : [];
        console.log('✅ Setting BSCS students:', bscsData.length);
        setStudentsBSCS(bscsData);
      } else if (Array.isArray(b2)) {
        console.log('✅ Setting BSCS students (direct array):', b2.length);
        setStudentsBSCS(b2);
      } else {
        console.warn('⚠️ No BSCS data or ok=false');
        setStudentsBSCS([]);
      }

      console.log('📊 BSEMC response:', b3);
      if (b3 && b3.ok && b3.data) {
        const bsemcData = Array.isArray(b3.data) ? b3.data : [];
        console.log('✅ Setting BSEMC students:', bsemcData.length);
        setStudentsBSEMC(bsemcData);
      } else if (Array.isArray(b3)) {
        console.log('✅ Setting BSEMC students (direct array):', b3.length);
        setStudentsBSEMC(b3);
      } else {
        console.warn('⚠️ No BSEMC data or ok=false');
        setStudentsBSEMC([]);
      }

      console.log('✅ loadAllLists completed');
    } catch (e) {
      console.error('❌ Load lists error:', e);
      // Don't clear data - keep existing
    } finally {
      setLoading(false);
    }
  };

  const loadSubjects = async () => {
    try {
      const res = await listSubjects();
      if (res?.ok) {
        const subjectsData = res.data || [];
        setSubjects(subjectsData);

        // Load only enrolled students from database (no auto-enrollment)
        const enrolledData = {};

        for (const subject of subjectsData) {
          try {
            // Load only actually enrolled students from database
            const enrolledRes = await getSubjectEnrolledStudents(subject.id);
            if (enrolledRes?.ok) {
              enrolledData[subject.id] = enrolledRes.data || [];
            } else {
              enrolledData[subject.id] = [];
            }
          } catch (e) {
            console.log(`Error loading enrolled students for subject ${subject.id}:`, e);
            enrolledData[subject.id] = [];
          }
        }
        setEnrolledStudents(enrolledData);
      } else {
        console.warn('⚠️ Subjects fetch failed or returned no data');
        // Don't clear subjects - keep existing data
      }
    } catch (e) {
      console.error('❌ Load subjects error:', e);
      // Don't clear subjects - keep existing data
    }
  };

  const refreshSubjects = async () => {
    try {
      const res = await listSubjects();
      if (res?.ok) {
        const subjectsData = res.data || [];
        setSubjects(subjectsData);

        // Load only enrolled students from database (no auto-enrollment)
        const enrolledData = {};

        for (const subject of subjectsData) {
          try {
            // Load only actually enrolled students from database
            const enrolledRes = await getSubjectEnrolledStudents(subject.id);
            if (enrolledRes?.ok) {
              enrolledData[subject.id] = enrolledRes.data || [];
            } else {
              enrolledData[subject.id] = [];
            }
          } catch (e) {
            console.log(`Error loading enrolled students for subject ${subject.id}:`, e);
            enrolledData[subject.id] = [];
          }
        }
        setEnrolledStudents(enrolledData);
      } else {
        console.warn('⚠️ Refresh subjects failed or returned no data');
        // Don't clear subjects - keep existing data
      }
    } catch (e) {
      console.error('❌ Refresh subjects error:', e);
      // Don't clear subjects - keep existing data
    }
  };

  const loadAvailableStudentsForSubject = async (subjectId) => {
    try {
      const subject = subjects.find(s => s.id === subjectId);
      if (!subject) return;

      // Load fresh enrolled students from database
      const enrolledRes = await getSubjectEnrolledStudents(subjectId);
      const currentEnrolled = enrolledRes?.ok ? (enrolledRes.data || []) : [];

      // Update enrolled students state
      setEnrolledStudents(prev => ({
        ...prev,
        [subjectId]: currentEnrolled
      }));

      // Fetch ALL students (not filtered by course or section)
      const studentsRes = await fetchAllStudents();
      if (studentsRes?.ok) {
        // Filter out already enrolled students only
        const enrolledIds = currentEnrolled.map(s => s.id);
        const available = studentsRes.data.filter(student => !enrolledIds.includes(student.id));

        setAvailableStudents(available);
        setAddStudentsSearchTerm(''); // Reset search when opening modal
        setShowAddStudentsModal(true);
      }
    } catch (e) {
      console.log(`Error loading available students:`, e);
      setAvailableStudents([]);
    }
  };

  const enrollStudent = async (student) => {
    if (!showStudentsModal) return;

    try {
      const res = await enrollStudentToSubject(showStudentsModal, student.id);
      if (res?.ok) {
        // Reload enrolled students from database
        const enrolledRes = await getSubjectEnrolledStudents(showStudentsModal);
        if (enrolledRes?.ok) {
          setEnrolledStudents(prev => ({
            ...prev,
            [showStudentsModal]: enrolledRes.data || []
          }));
        }

        // Remove from available students
        setAvailableStudents(prev => prev.filter(s => s.id !== student.id));

        // Show success message
        setToast({ show: true, message: `${student.full_name} has been enrolled successfully!`, type: 'success' });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 2500);
      } else {
        setToast({ show: true, message: res?.message || 'Failed to enroll student', type: 'error' });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
      }
    } catch (e) {
      console.log('Enroll student error', e);
      const errorMsg = e?.response?.data?.message || 'Network error';
      setToast({ show: true, message: errorMsg, type: 'error' });
      setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
    }
  };


  const unenrollStudent = async (studentId) => {
    if (!showStudentsModal) return;

    const student = enrolledStudents[showStudentsModal]?.find(s => s.id === studentId);

    try {
      const res = await unenrollStudentFromSubject(showStudentsModal, studentId);
      if (res?.ok) {
        // Reload enrolled students from database
        const enrolledRes = await getSubjectEnrolledStudents(showStudentsModal);
        if (enrolledRes?.ok) {
          setEnrolledStudents(prev => ({
            ...prev,
            [showStudentsModal]: enrolledRes.data || []
          }));
        }

        // Add back to available students if the subject modal is still open
        if (student && showAddStudentsModal) {
          setAvailableStudents(prev => [...prev, student]);
        }

        // Show success message
        if (student) {
          setToast({ show: true, message: `${student.full_name} has been removed from enrollment.`, type: 'success' });
          setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 2500);
        }
      } else {
        setToast({ show: true, message: res?.message || 'Failed to unenroll student', type: 'error' });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
      }
    } catch (e) {
      console.log('Unenroll student error', e);
      const errorMsg = e?.response?.data?.message || 'Network error';
      setToast({ show: true, message: errorMsg, type: 'error' });
      setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
    }
  };



  // Helper function to get profile picture URL
  const getProfilePictureUrl = (profilePicture) => {
    if (!profilePicture) return null;

    // If it's already a full URL, return it
    if (profilePicture.startsWith('http')) {
      return profilePicture;
    }

    // Otherwise, construct the full URL
    const apiBase = process.env.REACT_APP_API_BASE || 'http://127.0.0.1:8000';
    if (profilePicture.startsWith('/storage/')) {
      return `${apiBase}${profilePicture}`;
    } else if (profilePicture.startsWith('storage/')) {
      return `${apiBase}/${profilePicture}`;
    } else {
      return `${apiBase}/storage/${profilePicture}`;
    }
  };

  // Filter accounts based on search term
  const filterAccounts = (accounts, searchTerm) => {
    if (!searchTerm.trim()) return accounts;

    const term = searchTerm.toLowerCase();
    return accounts.filter(account =>
      account.full_name?.toLowerCase().includes(term) ||
      account.email?.toLowerCase().includes(term) ||
      account.student_number?.toLowerCase().includes(term) ||
      account.teacher_number?.toLowerCase().includes(term) ||
      account.section?.toLowerCase().includes(term) ||
      account.department?.toLowerCase().includes(term)
    );
  };

  // Group students by course, year, and section
  const groupStudentsBySection = (students) => {
    const groups = {};
    students.forEach(student => {
      const section = student.section || 'No Section';
      if (!groups[section]) {
        groups[section] = [];
      }
      groups[section].push(student);
    });
    return groups;
  };

  const mergeCustomSectionsIntoGroups = (groups, course) => {
    const merged = { ...groups };
    (customSections[course] || []).forEach((sec) => {
      if (sec && !merged[sec]) merged[sec] = [];
    });
    return merged;
  };

  const getAvailableSections = (course) => {
    if (!course) return [];
    const data = course === 'BSIT' ? studentsBSIT : course === 'BSCS' ? studentsBSCS : studentsBSEMC;
    const grouped = groupStudentsBySection(filterAccounts(data, ''));
    const existing = Object.keys(grouped);
    const customs = customSections[course] || [];
    const all = Array.from(new Set([
      ...existing.filter(Boolean),
      ...customs.filter(Boolean)
    ])).sort();
    return all;
  };

  const handleAddSection = (course) => {
    const section = (newSection.section || '').trim();
    if (!course || !['BSIT', 'BSCS', 'BSEMC'].includes(course)) return;
    if (!section) return;
    setCustomSections((prev) => {
      const list = prev[course] || [];
      if (list.includes(section)) return prev;
      const updated = { ...prev, [course]: [...list, section] };
      return updated;
    });
    setNewSection((s) => ({ ...s, section: '' }));
  };

  const validateForm = () => {
    const errs = {};
    if (!form.full_name.trim()) errs.full_name = 'Full name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email';
    if (!form.password || form.password.length < 6) errs.password = 'Min 6 characters';
    if (form.role === 'student') {
      // Required course selection and valid value
      if (!form.course) {
        errs.course = 'Course is required';
      } else if (!['BSIT', 'BSCS', 'BSEMC'].includes(form.course)) {
        errs.course = 'Invalid course';
      }
      // Required section
      if (!form.section || !form.section.trim()) {
        errs.section = 'Section is required';
      } else if (form.section.length > 50) {
        errs.section = 'Max 50 chars';
      }
      // Student number must be exactly 11 digits
      if (!form.student_number || !/^\d{11}$/.test(form.student_number)) {
        errs.student_number = 'Student number must be 11 digits';
      }
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submitCreateAccount = async () => {
    if (!validateForm()) return;
    try {
      setCreating(true);
      const payload = {
        role: form.role,
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      };
      if (form.role === 'student') {
        payload.course = form.course?.trim() || null;
        payload.section = form.section?.trim() || null;
        payload.student_number = form.student_number?.trim() || null; // optional; server will generate if null
      }
      const res = await createAccount(payload);
      if (res?.ok) {
        // Success toast
        setToast({ show: true, message: 'Account successfully created!', type: 'success' });
        // Auto-hide after 2.5s
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 2500);
        // Clear form after successful creation
        setForm({ role: 'student', full_name: '', email: '', password: '', course: '', section: '', student_number: '' });
        setFormErrors({});
        // Refresh lists
        await loadAllLists();
      } else {
        alert(res?.message || 'Failed to create account');
      }
    } catch (e) {
      console.log('Create account error:', e);
      const apiMsg = e?.response?.data?.message;
      alert(apiMsg || 'Network or server error');
    } finally {
      setCreating(false);
    }
  };

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
                  Admin Panel
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">Control Center</p>
              </div>
            </div>
            {/* Close button for mobile */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="space-y-2">
            <button
              onClick={() => setActiveSection('accounts')}
              className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 ${activeSection === 'accounts'
                ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/40 transform scale-105'
                : 'text-slate-600 hover:bg-gradient-to-r hover:from-rose-50 hover:to-red-50 hover:text-rose-700 dark:text-slate-300 dark:hover:from-rose-900/20 dark:hover:to-red-900/20 dark:hover:text-rose-300'
                }`}
            >
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
              Account Management
            </button>

            <button
              onClick={() => setActiveSection('add-account')}
              className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 ${activeSection === 'add-account'
                ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/40 transform scale-105'
                : 'text-slate-600 hover:bg-gradient-to-r hover:from-rose-50 hover:to-red-50 hover:text-rose-700 dark:text-slate-300 dark:hover:from-rose-900/20 dark:hover:to-red-900/20 dark:hover:text-rose-300'
                }`}
            >
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add New Account
            </button>

            <button
              onClick={() => setActiveSection('subjects')}
              className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 ${activeSection === 'subjects'
                ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/40 transform scale-105'
                : 'text-slate-600 hover:bg-gradient-to-r hover:from-rose-50 hover:to-red-50 hover:text-rose-700 dark:text-slate-300 dark:hover:from-rose-900/20 dark:hover:to-red-900/20 dark:hover:text-rose-300'
                }`}
            >
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6l7 2-7 2-7-2 7-2zM5 10l7 2 7-2M5 14l7 2 7-2" />
              </svg>
              Subject Management
            </button>

            <button
              onClick={() => setActiveSection('manage-subjects')}
              className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 ${activeSection === 'manage-subjects'
                ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/40 transform scale-105'
                : 'text-slate-600 hover:bg-gradient-to-r hover:from-rose-50 hover:to-red-50 hover:text-rose-700 dark:text-slate-300 dark:hover:from-rose-900/20 dark:hover:to-red-900/20 dark:hover:text-rose-300'
                }`}
            >
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6l7 2-7 2-7-2 7-2zM5 10l7 2 7-2M5 14l7 2 7-2" />
              </svg>
              Manage Subjects
            </button>

            <button
              onClick={() => setActiveSection('monitoring')}
              className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 ${activeSection === 'monitoring'
                ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/40 transform scale-105'
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
      <div className="flex-1 flex flex-col h-full relative z-10 lg:p-6 lg:h-[95vh] lg:my-auto lg:mr-6 overflow-hidden">
        <div className="flex-1 flex flex-col bg-white/40 backdrop-blur-3xl border border-white/30 dark:bg-slate-900/40 dark:border-white/10 shadow-2xl lg:rounded-3xl overflow-hidden">

          {/* Header */}
          <header className="bg-white/50 backdrop-blur-md border-b border-white/20 dark:bg-slate-800/50 dark:border-white/10 sticky top-0 z-40">
            <div className="px-4 lg:px-8 py-4 lg:py-5">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  {/* Mobile Menu Button */}
                  <button
                    onClick={() => setMobileMenuOpen(true)}
                    className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                  <div>
                    <h2 className="text-xl lg:text-3xl font-bold bg-gradient-to-r from-rose-600 to-red-600 bg-clip-text text-transparent dark:from-rose-400 dark:to-red-400">
                      {activeSection === 'accounts'
                        ? 'Account Management'
                        : activeSection === 'add-account'
                          ? 'Add New Account'
                          : activeSection === 'manage-subjects'
                            ? 'Manage Subjects'
                            : activeSection === 'monitoring'
                              ? 'Browser Monitoring'
                              : 'Subject Management'}
                    </h2>
                    <p className="text-xs lg:text-sm text-slate-500 dark:text-slate-400 mt-1">
                      {activeSection === 'monitoring'
                        ? 'Monitor student browser activity and sessions'
                        : 'Administer accounts, subjects, and enrollments with ease'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 lg:space-x-4">
                  <div className="hidden lg:flex items-center space-x-3 bg-gradient-to-r from-rose-50 to-red-50 dark:from-rose-900/30 dark:to-red-900/30 px-4 py-2 rounded-xl">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <div className="text-sm text-slate-700 dark:text-slate-300">
                      Welcome,{' '}
                      <span className="font-semibold text-rose-600 dark:text-rose-400">
                        {user?.fullName || 'Admin'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => loadAllLists(true)}
                    disabled={loading}
                    className="flex items-center space-x-2 px-3 lg:px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none disabled:cursor-not-allowed text-xs lg:text-sm"
                    title="Refresh all data"
                  >
                    <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span className="hidden lg:inline">{loading ? 'Refreshing...' : 'Refresh'}</span>
                  </button>
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
            </div >
          </header >

          <div className="flex-1 p-4 lg:p-8 overflow-y-auto relative z-10">
            {loading && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50 backdrop-blur-sm dark:bg-slate-900/50">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 border-4 border-rose-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="mt-4 text-slate-800 dark:text-slate-100 font-medium">Loading data...</p>
                </div>
              </div>
            )}

            {activeSection === 'accounts' && (
              <div className="space-y-6">
                {/* Account Management Actions */}
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-rose-600 to-red-600 bg-clip-text text-transparent">
                    Account Management
                  </h3>
                </div>

                {/* Search Bar */}
                <div className="mb-6 bg-white/40 backdrop-blur-xl border border-slate-200/60 rounded-2xl p-4 shadow-lg dark:bg-slate-900/40 dark:border-slate-800/60">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Search accounts by name, email, student number, section, or department..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300/50 rounded-lg leading-5 bg-white/30 backdrop-blur-sm placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-sm dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100 dark:placeholder-slate-400"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {searchTerm && (
                    <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                      Searching for:{' '}
                      <span className="font-medium text-rose-600 dark:text-rose-400">"{searchTerm}"</span>
                    </div>
                  )}
                </div>



                {/* Tabs */}
                <div className="mb-6 bg-white/40 backdrop-blur-xl border border-slate-200/60 rounded-2xl px-4 py-3 shadow-lg dark:bg-slate-900/40 dark:border-slate-800/60">
                  <nav className="flex flex-wrap gap-3">
                    {[
                      { id: 'teachers', label: 'Teachers' },
                      { id: 'bsit', label: 'Students - BSIT' },
                      { id: 'bscs', label: 'Students - BSCS' },
                      { id: 'bsemc', label: 'Students - BSEMC' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ${tab === t.id
                          ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/40'
                          : 'text-slate-600 hover:text-rose-600 hover:bg-rose-50/80 dark:text-slate-300 dark:hover:bg-rose-900/30'
                          }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </nav>
                </div>

                {/* Tables per tab */}
                <div className="overflow-x-auto">
                  {/* Debug Info */}
                  <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>Debug Info:</strong> Teachers loaded: {teachers.length} |
                      Filtered teachers: {filterAccounts(teachers, searchTerm).length} |
                      Search term: "{searchTerm}"
                    </p>
                  </div>

                  {tab === 'teachers' && (
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                      <thead className="bg-gray-50/40 backdrop-blur-sm dark:bg-slate-800/40">
                        <tr>
                          <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Photo</th>
                          <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Name</th>
                          <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Email</th>
                          <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Teacher #</th>
                          <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Department</th>
                          <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Status</th>
                          <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white/30 backdrop-blur-sm divide-y divide-gray-200/50 dark:bg-slate-900/30 dark:divide-slate-700/50">
                        {filterAccounts(teachers, searchTerm).map((t) => {
                          const profilePicUrl = getProfilePictureUrl(t.profile_picture);
                          return (
                            <tr key={t.id}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex-shrink-0 h-10 w-10">
                                  {profilePicUrl ? (
                                    <img
                                      className="h-10 w-10 rounded-full object-cover border-2 border-rose-200 dark:border-rose-700"
                                      src={profilePicUrl}
                                      alt={t.full_name}
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'flex';
                                      }}
                                    />
                                  ) : null}
                                  <div
                                    className={`h-10 w-10 rounded-full bg-gradient-to-br from-rose-100 to-red-100 dark:from-rose-900/30 dark:to-red-900/30 border-2 border-rose-200 dark:border-rose-700 flex items-center justify-center ${profilePicUrl ? 'hidden' : 'flex'}`}
                                  >
                                    <svg className="h-6 w-6 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-xs lg:text-sm text-slate-800 dark:text-slate-100">{t.full_name}</td>
                              <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-xs lg:text-sm text-gray-500 dark:text-slate-300">{t.email}</td>
                              <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-xs lg:text-sm">{t.teacher_number || '-'}</td>
                              <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-xs lg:text-sm">{t.department || '-'}</td>
                              <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${t.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-200'}`}>
                                  {t.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-xs lg:text-sm font-medium space-x-1 lg:space-x-2">
                                <button onClick={() => openEdit(t)} className="text-rose-600 hover:text-red-700 dark:text-rose-400 dark:hover:text-rose-300">Edit</button>
                                <button onClick={() => handleDeleteAccount(t.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">Delete</button>
                              </td>
                            </tr>
                          );
                        })}
                        {filterAccounts(teachers, searchTerm).length === 0 && (
                          <tr>
                            <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                              {searchTerm ? `No teachers found matching "${searchTerm}"` : 'No teachers found'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}

                  {tab === 'bsit' && (
                    <div className="space-y-6">
                      <div className="flex items-end space-x-3">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-700 dark:text-slate-300">Add Section for BSIT</label>
                          <input
                            type="text"
                            value={newSection.section}
                            onChange={(e) => setNewSection((s) => ({ ...s, section: e.target.value }))}
                            placeholder="Add Section"
                            className="mt-1 block w-full max-w-sm border-gray-300 rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100"
                          />
                        </div>
                        <button
                          onClick={() => handleAddSection('BSIT')}
                          className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300"
                        >
                          Add Section
                        </button>
                      </div>
                      {Object.entries(mergeCustomSectionsIntoGroups(groupStudentsBySection(filterAccounts(studentsBSIT, searchTerm)), 'BSIT')).map(([section, students]) => (
                        <div key={section} className="mb-6">
                          <div className="px-3 lg:px-6 py-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-slate-100">
                              BSIT - {section} ({students.length} student{students.length !== 1 ? 's' : ''})
                            </h3>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                              <thead className="bg-gray-50/40 backdrop-blur-sm dark:bg-slate-800/40">
                                <tr>
                                  <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Photo</th>
                                  <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Name</th>
                                  <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Email</th>
                                  <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Student #</th>
                                  <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Status</th>
                                  <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white/30 backdrop-blur-sm divide-y divide-gray-200/50 dark:bg-slate-900/30 dark:divide-slate-700/50">
                                {students.map((s) => {
                                  const profilePicUrl = getProfilePictureUrl(s.profile_picture);
                                  return (
                                    <tr key={s.id}>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex-shrink-0 h-10 w-10">
                                          {profilePicUrl ? (
                                            <img
                                              className="h-10 w-10 rounded-full object-cover border-2 border-rose-200 dark:border-rose-700"
                                              src={profilePicUrl}
                                              alt={s.full_name}
                                              onError={(e) => {
                                                e.target.style.display = 'none';
                                                e.target.nextSibling.style.display = 'flex';
                                              }}
                                            />
                                          ) : null}
                                          <div
                                            className={`h-10 w-10 rounded-full bg-gradient-to-br from-rose-100 to-red-100 dark:from-rose-900/30 dark:to-red-900/30 border-2 border-rose-200 dark:border-rose-700 flex items-center justify-center ${profilePicUrl ? 'hidden' : 'flex'}`}
                                          >
                                            <svg className="h-6 w-6 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-xs lg:text-sm text-slate-800 dark:text-slate-100">{s.full_name}</td>
                                      <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-xs lg:text-sm text-gray-500 dark:text-slate-300">{s.email}</td>
                                      <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-xs lg:text-sm">{s.student_number}</td>
                                      <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${s.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-200'}`}>
                                          {s.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                      </td>
                                      <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-xs lg:text-sm font-medium space-x-1 lg:space-x-2">
                                        <button onClick={() => openEdit(s)} className="text-rose-600 hover:text-red-700 dark:text-rose-400 dark:hover:text-rose-300">Edit</button>
                                        <button onClick={() => handleDeleteAccount(s.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">Delete</button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                      {Object.keys(groupStudentsBySection(filterAccounts(studentsBSIT, searchTerm))).length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          {searchTerm ? `No BSIT students found matching "${searchTerm}"` : 'No BSIT students found'}
                        </div>
                      )}
                    </div>
                  )}

                  {tab === 'bscs' && (
                    <div className="space-y-6">
                      <div className="flex items-end space-x-3">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-700 dark:text-slate-300">Add Section for BSCS</label>
                          <input
                            type="text"
                            value={newSection.section}
                            onChange={(e) => setNewSection((s) => ({ ...s, section: e.target.value }))}
                            placeholder="Add Section"
                            className="mt-1 block w-full max-w-sm border-gray-300 rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100"
                          />
                        </div>
                        <button
                          onClick={() => handleAddSection('BSCS')}
                          className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300"
                        >
                          Add Section
                        </button>
                      </div>
                      {Object.entries(mergeCustomSectionsIntoGroups(groupStudentsBySection(filterAccounts(studentsBSCS, searchTerm)), 'BSCS')).map(([section, students]) => (
                        <div key={section} className="mb-6">
                          <div className="px-3 lg:px-6 py-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-slate-100">
                              BSCS - {section} ({students.length} student{students.length !== 1 ? 's' : ''})
                            </h3>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                              <thead className="bg-gray-50/40 backdrop-blur-sm dark:bg-slate-800/40">
                                <tr>
                                  <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Photo</th>
                                  <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Name</th>
                                  <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Email</th>
                                  <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Student #</th>
                                  <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Status</th>
                                  <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white/30 backdrop-blur-sm divide-y divide-gray-200/50 dark:bg-slate-900/30 dark:divide-slate-700/50">
                                {students.map((s) => {
                                  const profilePicUrl = getProfilePictureUrl(s.profile_picture);
                                  return (
                                    <tr key={s.id}>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex-shrink-0 h-10 w-10">
                                          {profilePicUrl ? (
                                            <img
                                              className="h-10 w-10 rounded-full object-cover border-2 border-rose-200 dark:border-rose-700"
                                              src={profilePicUrl}
                                              alt={s.full_name}
                                              onError={(e) => {
                                                e.target.style.display = 'none';
                                                e.target.nextSibling.style.display = 'flex';
                                              }}
                                            />
                                          ) : null}
                                          <div
                                            className={`h-10 w-10 rounded-full bg-gradient-to-br from-rose-100 to-red-100 dark:from-rose-900/30 dark:to-red-900/30 border-2 border-rose-200 dark:border-rose-700 flex items-center justify-center ${profilePicUrl ? 'hidden' : 'flex'}`}
                                          >
                                            <svg className="h-6 w-6 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-xs lg:text-sm text-slate-800 dark:text-slate-100">{s.full_name}</td>
                                      <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-xs lg:text-sm text-gray-500 dark:text-slate-300">{s.email}</td>
                                      <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-xs lg:text-sm">{s.student_number}</td>
                                      <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${s.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-200'}`}>
                                          {s.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                      </td>
                                      <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-xs lg:text-sm font-medium space-x-1 lg:space-x-2">
                                        <button onClick={() => openEdit(s)} className="text-rose-600 hover:text-red-700 dark:text-rose-400 dark:hover:text-rose-300">Edit</button>
                                        <button onClick={() => handleDeleteAccount(s.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">Delete</button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                      {Object.keys(groupStudentsBySection(filterAccounts(studentsBSCS, searchTerm))).length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          {searchTerm ? `No BSCS students found matching "${searchTerm}"` : 'No BSCS students found'}
                        </div>
                      )}
                    </div>
                  )}

                  {tab === 'bsemc' && (
                    <div className="space-y-6">
                      <div className="flex items-end space-x-3">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-700 dark:text-slate-300">Add Section for BSEMC</label>
                          <input
                            type="text"
                            value={newSection.section}
                            onChange={(e) => setNewSection((s) => ({ ...s, section: e.target.value }))}
                            placeholder="Add Section"
                            className="mt-1 block w-full max-w-sm border-gray-300 rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100"
                          />
                        </div>
                        <button
                          onClick={() => handleAddSection('BSEMC')}
                          className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300"
                        >
                          Add Section
                        </button>
                      </div>
                      {Object.entries(mergeCustomSectionsIntoGroups(groupStudentsBySection(filterAccounts(studentsBSEMC, searchTerm)), 'BSEMC')).map(([section, students]) => (
                        <div key={section} className="mb-6">
                          <div className="px-3 lg:px-6 py-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-slate-100">
                              BSEMC - {section} ({students.length} student{students.length !== 1 ? 's' : ''})
                            </h3>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                              <thead className="bg-gray-50/40 backdrop-blur-sm dark:bg-slate-800/40">
                                <tr>
                                  <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Photo</th>
                                  <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Name</th>
                                  <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Email</th>
                                  <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Student #</th>
                                  <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Status</th>
                                  <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white/30 backdrop-blur-sm divide-y divide-gray-200/50 dark:bg-slate-900/30 dark:divide-slate-700/50">
                                {students.map((s) => {
                                  const profilePicUrl = getProfilePictureUrl(s.profile_picture);
                                  return (
                                    <tr key={s.id}>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex-shrink-0 h-10 w-10">
                                          {profilePicUrl ? (
                                            <img
                                              className="h-10 w-10 rounded-full object-cover border-2 border-rose-200 dark:border-rose-700"
                                              src={profilePicUrl}
                                              alt={s.full_name}
                                              onError={(e) => {
                                                e.target.style.display = 'none';
                                                e.target.nextSibling.style.display = 'flex';
                                              }}
                                            />
                                          ) : null}
                                          <div
                                            className={`h-10 w-10 rounded-full bg-gradient-to-br from-rose-100 to-red-100 dark:from-rose-900/30 dark:to-red-900/30 border-2 border-rose-200 dark:border-rose-700 flex items-center justify-center ${profilePicUrl ? 'hidden' : 'flex'}`}
                                          >
                                            <svg className="h-6 w-6 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-xs lg:text-sm text-slate-800 dark:text-slate-100">{s.full_name}</td>
                                      <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-xs lg:text-sm text-gray-500 dark:text-slate-300">{s.email}</td>
                                      <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-xs lg:text-sm">{s.student_number}</td>
                                      <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${s.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-200'}`}>
                                          {s.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                      </td>
                                      <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-xs lg:text-sm font-medium space-x-1 lg:space-x-2">
                                        <button onClick={() => openEdit(s)} className="text-rose-600 hover:text-red-700 dark:text-rose-400 dark:hover:text-rose-300">Edit</button>
                                        <button onClick={() => handleDeleteAccount(s.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">Delete</button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                      {Object.keys(groupStudentsBySection(filterAccounts(studentsBSEMC, searchTerm))).length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          {searchTerm ? `No BSEMC students found matching "${searchTerm}"` : 'No BSEMC students found'}
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>
            )}

            {activeSection === 'add-account' && (
              <div className="space-y-6">
                {/* Add New Account Form */}
                <div className="bg-white/40 backdrop-blur-xl shadow-2xl rounded-2xl border border-slate-200/60 p-4 lg:p-6 dark:bg-slate-900/40 dark:border-slate-800/60">
                  <div className="mb-6">
                    <h3 className="text-xl font-semibold text-slate-800 mb-2 dark:text-slate-100">Create New Account</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Fill in the details below to create a new user account</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">Account Type</label>
                      <select
                        value={form.role}
                        onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500 py-2 px-3 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100"
                      >
                        <option value="student">Student</option>
                        <option value="teacher">Teacher</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">Full Name</label>
                      <input
                        type="text"
                        value={form.full_name}
                        onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                        className={`w-full border rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500 py-2 px-3 ${formErrors.full_name ? 'border-red-300 bg-red-50' : 'border-gray-300 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100'}`}
                        placeholder="Enter full name"
                      />
                      {formErrors.full_name && <p className="mt-1 text-xs text-red-600">{formErrors.full_name}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">Email</label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        className={`w-full border rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500 py-2 px-3 ${formErrors.email ? 'border-red-300 bg-red-50' : 'border-gray-300 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100'}`}
                        placeholder="Enter email address"
                      />
                      {formErrors.email && <p className="mt-1 text-xs text-red-600">{formErrors.email}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">Password</label>
                      <input
                        type="password"
                        value={form.password}
                        onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                        className={`w-full border rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500 py-2 px-3 ${formErrors.password ? 'border-red-300 bg-red-50' : 'border-gray-300 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100'}`}
                        placeholder="Enter password"
                      />
                      {formErrors.password && <p className="mt-1 text-xs text-red-600">{formErrors.password}</p>}
                    </div>

                    {form.role === 'student' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">Course</label>
                          <select
                            value={form.course}
                            onChange={(e) => setForm((f) => ({ ...f, course: e.target.value }))}
                            className={`w-full border rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500 py-2 px-3 ${formErrors.course ? 'border-red-300 bg-red-50' : 'border-gray-300 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100'}`}
                          >
                            <option value="">Select course</option>
                            <option value="BSIT">BSIT</option>
                            <option value="BSCS">BSCS</option>
                            <option value="BSEMC">BSEMC</option>
                          </select>
                          {formErrors.course && <p className="mt-1 text-xs text-red-600">{formErrors.course}</p>}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">Section</label>
                          <input
                            type="text"
                            value={form.section}
                            onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))}
                            className={`w-full border rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500 py-2 px-3 ${formErrors.section ? 'border-red-300 bg-red-50' : 'border-gray-300 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100'}`}
                            placeholder="BSIT 3-Y1-2"
                          />
                          {formErrors.section && <p className="mt-1 text-xs text-red-600">{formErrors.section}</p>}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">Student Number</label>
                          <input
                            type="text"
                            value={form.student_number}
                            onChange={(e) => setForm((f) => ({ ...f, student_number: e.target.value }))}
                            className={`w-full border rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-2 px-3 ${formErrors.student_number ? 'border-red-300 bg-red-50' : 'border-gray-300 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100'}`}
                            placeholder="Student Number"
                          />
                          {formErrors.student_number && <p className="mt-1 text-xs text-red-600">{formErrors.student_number}</p>}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-slate-800">
                    <button
                      onClick={() => {
                        setForm({ role: 'student', full_name: '', email: '', password: '', course: '', section: '', student_number: '' });
                        setFormErrors({});
                      }}
                      className="px-6 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      Clear Form
                    </button>
                    <button
                      onClick={submitCreateAccount}
                      disabled={creating}
                      className={`px-6 py-2 text-sm font-medium text-white rounded-lg transition-colors ${creating ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                    >
                      {creating ? 'Creating...' : 'Create Account'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'subjects' && (
              <div className="space-y-6">
                {/* Subject Management Actions */}
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-rose-600 to-red-600 bg-clip-text text-transparent">
                    Subject Management
                  </h3>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-rose-500 rounded-full"></div>
                      <span className="text-sm text-slate-600 font-medium">{subjects.length} Subject{subjects.length !== 1 ? 's' : ''}</span>
                    </div>
                    <button
                      onClick={refreshSubjects}
                      className="bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>Refresh</span>
                    </button>
                  </div>
                </div>

                {/* Dynamic Subjects Cards */}
                {subjects.length > 0 ? (
                  <div className="mb-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
                      {subjects.map((subject, index) => (
                        <div
                          key={subject.id}
                          className="bg-white/40 backdrop-blur-xl overflow-hidden shadow-lg rounded-lg hover:shadow-2xl transition-all duration-500 transform hover:scale-105 cursor-pointer border-2 border-transparent hover:border-rose-300/50 dark:bg-slate-900/40 dark:hover:border-rose-700/50"
                          onClick={() => setShowStudentsModal(subject.id)}
                        >
                          <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex-shrink-0">
                                <div className="w-16 h-16 bg-gradient-to-br from-rose-100 to-red-100 rounded-lg flex items-center justify-center shadow-lg dark:from-rose-900/30 dark:to-red-900/20">
                                  <svg className="w-8 h-8 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6l7 2-7 2-7-2 7-2zM5 10l7 2 7-2M5 14l7 2 7-2" />
                                  </svg>
                                </div>
                              </div>
                              <div className="flex-1 ml-4">
                                <h3 className="text-lg font-medium text-slate-800 truncate hover:text-rose-700 transition-colors duration-300 dark:text-slate-100 dark:hover:text-rose-300">{subject.name}</h3>
                                <p className="text-sm text-rose-600 font-mono bg-rose-50 px-2 py-1 rounded dark:text-rose-200 dark:bg-rose-900/30 dark:border dark:border-rose-700">{subject.code}</p>
                              </div>
                            </div>
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Course:</span>
                                <span className="text-xs text-rose-600 bg-rose-50 px-3 py-1 rounded-full border border-rose-200 dark:text-rose-200 dark:bg-rose-900/30 dark:border-rose-700">{subject.course}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Section:</span>
                                <span className="text-xs text-rose-600 bg-rose-50 px-3 py-1 rounded-full border border-rose-200 truncate dark:text-rose-200 dark:bg-rose-900/30 dark:border-rose-700">{subject.section}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Teacher:</span>
                                <span className="text-xs text-rose-600 bg-rose-50 px-3 py-1 rounded-full border border-rose-200 truncate dark:text-rose-200 dark:bg-rose-900/30 dark:border-rose-700">
                                  {subject.teacher_name || 'Not assigned'}
                                </span>
                              </div>
                            </div>

                            {/* Students enrolled in this subject */}
                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Enrolled Students:</span>
                                <span className="text-xs text-rose-600 bg-rose-100 px-2 py-1 rounded-full dark:text-rose-200 dark:bg-rose-900/40">
                                  {enrolledStudents[subject.id]?.length || 0}
                                </span>
                              </div>
                              <div className="max-h-20 overflow-y-auto">
                                {enrolledStudents[subject.id]?.length > 0 ? (
                                  <div className="space-y-1">
                                    {enrolledStudents[subject.id].slice(0, 3).map((student, idx) => (
                                      <div key={idx} className="flex items-center justify-between text-xs">
                                        <span className="text-slate-800 truncate dark:text-slate-100">{student.full_name}</span>
                                        <span className="text-slate-500 text-xs dark:text-slate-400">{student.student_number}</span>
                                      </div>
                                    ))}
                                    {enrolledStudents[subject.id].length > 3 && (
                                      <div className="text-xs text-rose-500 text-center dark:text-rose-300">
                                        +{enrolledStudents[subject.id].length - 3} more students
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-xs text-slate-400 text-center dark:text-slate-500">No students enrolled</div>
                                )}
                              </div>
                            </div>

                            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500 font-medium dark:text-slate-400">Created</span>
                                <span className="text-xs text-slate-500 bg-slate-50/40 backdrop-blur-sm px-2 py-1 rounded dark:text-slate-400 dark:bg-slate-800/40">
                                  {new Date(subject.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/40 backdrop-blur-xl border border-slate-200/60 rounded-2xl p-8 flex flex-col items-center justify-center text-center shadow-lg dark:bg-slate-900/40 dark:border-slate-800/60">
                    <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mb-4 dark:bg-rose-900/30">
                      <svg className="w-8 h-8 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 19.477 5.754 20 7.5 20s3.332-.477 4.5-1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 19.477 18.247 20 16.5 20c-1.746 0-3.332-.477-4.5-1.253" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">No Subjects Found</h3>
                    <p className="text-slate-600 dark:text-slate-400 max-w-md">
                      There are no subjects created yet. Go to <span className="font-semibold text-rose-600 cursor-pointer" onClick={() => setActiveSection('manage-subjects')}>Manage Subjects</span> to create a new one.
                    </p>
                  </div>
                )}
              </div>

            )}

            {activeSection === 'monitoring' && (
              <div className="space-y-6">
                <BrowserMonitoringDashboard
                  userRole="admin"
                  enrolledStudents={[
                    ...studentsBSIT,
                    ...studentsBSCS,
                    ...studentsBSEMC
                  ]}
                />
              </div>
            )}

            {activeSection === 'manage-subjects' && (
              <div className="space-y-6">
                {/* Manage Subjects (inline, formerly modal) */}
                <div className="bg-white/40 backdrop-blur-xl shadow-2xl rounded-2xl border border-slate-200/60 p-4 lg:p-6 dark:bg-slate-900/40 dark:border-slate-800/60">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-rose-600 to-red-600 bg-clip-text text-transparent">
                      Subject Management
                    </h3>
                    <button
                      onClick={refreshSubjects}
                      className="bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>Refresh</span>
                    </button>
                  </div>

                  {/* Create Subject Form */}
                  <div className="bg-white/40 border border-slate-200/60 rounded-2xl p-4 mb-6 hover:shadow-xl transition-all duration-300 dark:bg-slate-900/40 dark:border-slate-800/60">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Subject Code</label>
                        <input
                          type="text"
                          value={newSubject.code}
                          onChange={(e) => setNewSubject((s) => ({ ...s, code: e.target.value }))}
                          className={`mt-1 block w-full border rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500 transition-all duration-300 ${subErrors.code ? 'border-red-300 bg-red-50' : 'border-slate-300 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100'}`}
                          placeholder="example:311, 112, 211,"
                        />
                        {subErrors.code && <p className="mt-1 text-[10px] text-red-600">{subErrors.code}</p>}
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Subject Name</label>
                        <input
                          type="text"
                          value={newSubject.name}
                          onChange={(e) => setNewSubject((s) => ({ ...s, name: e.target.value }))}
                          className={`mt-1 block w-full border rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500 transition-all duration-300 ${subErrors.name ? 'border-red-300 bg-red-50' : 'border-slate-300 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100'}`}
                          placeholder="WEBDEV, IPTC, DBSA"
                        />
                        {subErrors.name && <p className="mt-1 text-[10px] text-red-600">{subErrors.name}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Course</label>
                        <select
                          value={newSubject.course}
                          onChange={(e) => {
                            const course = e.target.value;
                            const options = getAvailableSections(course);
                            setNewSubject((s) => ({ ...s, course, section: options.includes(s.section) ? s.section : '' }));
                          }}
                          className={`mt-1 block w-full border rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500 transition-all duration-300 ${subErrors.course ? 'border-red-300 bg-red-50' : 'border-slate-300 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100'}`}
                        >
                          <option value="">Select</option>
                          <option value="BSIT">BSIT</option>
                          <option value="BSCS">BSCS</option>
                          <option value="BSEMC">BSEMC</option>
                        </select>
                        {subErrors.course && <p className="mt-1 text-[10px] text-red-600">{subErrors.course}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Section</label>
                        <select
                          value={newSubject.section}
                          onChange={(e) => setNewSubject((s) => ({ ...s, section: e.target.value }))}
                          disabled={!newSubject.course}
                          className={`mt-1 block w-full border rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500 transition-all duration-300 ${subErrors.section ? 'border-red-300 bg-red-50' : 'border-slate-300 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100'}`}
                        >
                          <option value="">{newSubject.course ? 'Select section' : 'Select course first'}</option>
                          {getAvailableSections(newSubject.course).map((sec) => (
                            <option key={sec} value={sec}>{sec}</option>
                          ))}
                        </select>
                        {subErrors.section && <p className="mt-1 text-[10px] text-red-600">{subErrors.section}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Teacher</label>
                        <select
                          value={newSubject.teacher_user_id}
                          onChange={(e) => setNewSubject((s) => ({ ...s, teacher_user_id: e.target.value }))}
                          className={`mt-1 block w-full border rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500 transition-all duration-300 ${subErrors.teacher_user_id ? 'border-red-300 bg-red-50' : 'border-slate-300 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100'}`}
                        >
                          <option value="">Select Teacher</option>
                          {teachers.map((teacher) => (
                            <option key={teacher.id} value={teacher.id}>
                              {teacher.full_name} {teacher.teacher_number ? `(${teacher.teacher_number})` : ''}
                            </option>
                          ))}
                        </select>
                        {subErrors.teacher_user_id && <p className="mt-1 text-[10px] text-red-600">{subErrors.teacher_user_id}</p>}
                      </div>
                    </div>
                    <div className="flex justify-end mt-3">
                      <button
                        onClick={async () => {
                          const errs = {};
                          if (!newSubject.code.trim()) errs.code = 'Required';
                          if (!newSubject.name.trim()) errs.name = 'Required';
                          if (!newSubject.course) errs.course = 'Required';
                          if (!newSubject.section.trim()) errs.section = 'Required';
                          if (!newSubject.teacher_user_id) errs.teacher_user_id = 'Required';
                          setSubErrors(errs);
                          if (Object.keys(errs).length) return;
                          try {
                            const payload = {
                              code: newSubject.code,
                              name: newSubject.name,
                              course: newSubject.course,
                              section: newSubject.section,
                              teacher_user_id: newSubject.teacher_user_id ? parseInt(newSubject.teacher_user_id) : null
                            };
                            const res = await createSubject(payload);
                            if (res?.ok) {
                              await refreshSubjects();
                              setNewSubject({ code: '', name: '', course: '', section: '', teacher_user_id: '' });
                              setSubErrors({});
                              setToast({ show: true, message: 'Subject created successfully!', type: 'success' });
                              setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 2500);
                            } else {
                              setToast({ show: true, message: res?.message || 'Failed to create subject', type: 'error' });
                              setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
                            }
                          } catch (e) {
                            console.log('Create subject error', e);
                            const errorMsg = e?.response?.data?.message || 'Network error';
                            setToast({ show: true, message: errorMsg, type: 'error' });
                            setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
                          }
                        }}
                        className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-rose-600 via-red-600 to-red-600 hover:from-rose-700 hover:via-red-700 hover:to-red-700 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-rose-500/40"
                      >
                        Add Subject
                      </button>
                    </div>
                  </div>

                  {/* Subjects Table */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-xs dark:divide-slate-700">
                      <thead className="bg-slate-100/40 backdrop-blur-sm dark:bg-slate-800/40">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-slate-700 uppercase tracking-wider dark:text-slate-300">Code</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-700 uppercase tracking-wider dark:text-slate-300">Subject</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-700 uppercase tracking-wider dark:text-slate-300">Course</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-700 uppercase tracking-wider dark:text-slate-300">Section</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-700 uppercase tracking-wider dark:text-slate-300">Teacher</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-700 uppercase tracking-wider dark:text-slate-300">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white/30 backdrop-blur-sm divide-y divide-slate-200/50 dark:bg-slate-900/30 dark:divide-slate-700/50">
                        {subjects.map((sub) => (
                          <tr key={sub.id} className="hover:bg-slate-50/40 backdrop-blur-sm transition-colors duration-200 dark:hover:bg-slate-800/40">
                            <td className="px-3 py-1 whitespace-nowrap text-slate-800 dark:text-slate-100">{sub.code}</td>
                            <td className="px-3 py-1 whitespace-nowrap text-slate-800 dark:text-slate-100">{sub.name}</td>
                            <td className="px-3 py-1 whitespace-nowrap text-slate-800 dark:text-slate-100">{sub.course}</td>
                            <td className="px-3 py-1 whitespace-nowrap text-slate-800 dark:text-slate-100">{sub.section}</td>
                            <td className="px-3 py-1 whitespace-nowrap text-slate-800 dark:text-slate-100">
                              {sub.teacher_name || <span className="text-slate-400 italic">Not assigned</span>}
                            </td>
                            <td className="px-3 py-1 whitespace-nowrap">
                              <button
                                onClick={async () => {
                                  try {
                                    const res = await deleteSubject(sub.id);
                                    if (res?.ok) {
                                      await refreshSubjects();
                                    }
                                  } catch (e) { console.log('Delete subject error', e); }
                                }}
                                className="text-red-600 hover:text-red-800 transition-colors duration-300 transform hover:scale-110 dark:text-red-400 dark:hover:text-red-300"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                        {subjects.length === 0 && (
                          <tr>
                            <td className="px-3 py-2 text-slate-500" colSpan="6">No subjects yet. Create one above.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div >

        {/* Enrolled Students Modal */}
        {
          showStudentsModal && (() => {
            const selectedSubject = subjects.find(s => s.id === showStudentsModal);
            if (!selectedSubject) return null;

            return (
              <div
                className="fixed inset-0 bg-slate-900 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4 transition-opacity duration-300"
                onClick={() => setShowStudentsModal(null)}
              >
                <div
                  className="relative bg-white/40 backdrop-blur-xl rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col transform transition-all duration-300 scale-100 dark:bg-slate-900/40 dark:border dark:border-slate-800/50"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 lg:p-6 border-b border-slate-200 dark:border-slate-800 gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl lg:text-2xl font-bold text-slate-800 dark:text-slate-100">Enrolled Students</h3>
                      <p className="text-xs lg:text-sm text-slate-600 mt-1 dark:text-slate-400 break-words">
                        Subject: {selectedSubject.name} ({selectedSubject.code}) - {selectedSubject.course} {selectedSubject.section}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 lg:space-x-4 w-full sm:w-auto">
                      <button
                        onClick={() => loadAvailableStudentsForSubject(selectedSubject.id)}
                        className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center space-x-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        <span>Add Students</span>
                      </button>
                      <span className="text-sm text-rose-600 bg-rose-100 px-4 py-2 rounded-full font-medium dark:text-rose-200 dark:bg-rose-900/40">
                        {enrolledStudents[selectedSubject.id]?.length || 0} {enrolledStudents[selectedSubject.id]?.length === 1 ? 'Student' : 'Students'}
                      </span>
                      <button
                        onClick={() => setShowStudentsModal(null)}
                        className="text-slate-400 hover:text-slate-600 transition-colors duration-300 p-2 hover:bg-slate-100 rounded-lg dark:hover:bg-slate-800"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Modal Body - Table */}
                  <div className="flex-1 overflow-y-auto p-6">
                    {enrolledStudents[selectedSubject.id]?.length > 0 ? (
                      <div className="overflow-x-auto border border-slate-200 rounded-lg dark:border-slate-800">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                          <thead className="bg-slate-50/40 backdrop-blur-sm sticky top-0 dark:bg-slate-800/40">
                            <tr>
                              <th className="px-6 py-4 text-left text-xs font-medium text-slate-700 uppercase tracking-wider dark:text-slate-300">Student Number</th>
                              <th className="px-6 py-4 text-left text-xs font-medium text-slate-700 uppercase tracking-wider dark:text-slate-300">Full Name</th>
                              <th className="px-6 py-4 text-left text-xs font-medium text-slate-700 uppercase tracking-wider dark:text-slate-300">Email</th>
                              <th className="px-6 py-4 text-left text-xs font-medium text-slate-700 uppercase tracking-wider dark:text-slate-300">Status</th>
                              <th className="px-6 py-4 text-right text-xs font-medium text-slate-700 uppercase tracking-wider dark:text-slate-300">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white/30 backdrop-blur-sm divide-y divide-slate-200/50 dark:bg-slate-900/30 dark:divide-slate-700/50">
                            {enrolledStudents[selectedSubject.id].map((student, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/40 backdrop-blur-sm transition-colors duration-150 dark:hover:bg-slate-800/40">
                                <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-xs lg:text-sm text-slate-800 font-medium dark:text-slate-100">
                                  {student.student_number || '-'}
                                </td>
                                <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-xs lg:text-sm text-slate-800 dark:text-slate-100">
                                  {student.full_name || '-'}
                                </td>
                                <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-xs lg:text-sm text-slate-600 dark:text-slate-300">
                                  {student.email || '-'}
                                </td>
                                <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap">
                                  <span className={`px-2 lg:px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${student.is_active
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                                    }`}>
                                    {student.is_active ? 'Active' : 'Inactive'}
                                  </span>
                                </td>
                                <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-right text-xs lg:text-sm font-medium">
                                  <button
                                    onClick={() => unenrollStudent(student.id)}
                                    className="text-red-600 hover:text-red-800 transition-colors duration-200 dark:text-red-400 dark:hover:text-red-300"
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-12 text-center border border-slate-200 rounded-lg bg-slate-50 dark:bg-slate-800 dark:border-slate-700">
                        <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 11a4 4 0 100-8 4 4 0 000 8z" />
                        </svg>
                        <div className="text-slate-400 text-base font-medium mb-2 dark:text-slate-500">No students enrolled</div>
                        <div className="text-slate-300 text-sm dark:text-slate-500">Click "Add Students" to enroll students to this subject</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()
        }

        {/* Add Students Modal */}
        {
          showAddStudentsModal && showStudentsModal && (() => {
            const selectedSubject = subjects.find(s => s.id === showStudentsModal);
            if (!selectedSubject) return null;

            return (
              <div
                className="fixed inset-0 bg-slate-900/30 dark:bg-slate-950/40 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4 transition-opacity duration-300"
                onClick={() => {
                  setShowAddStudentsModal(false);
                  setAddStudentsSearchTerm(''); // Reset search when closing modal
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
                    <div className="flex items-center gap-2 lg:gap-3 w-full sm:w-auto">
                      {(() => {
                        const courseMap = { bsit: 'BSIT', bscs: 'BSCS', bsemc: 'BSEMC' };
                        const selectedCourse = courseMap[addStudentsTab] || 'BSIT';
                        const courseStudents = availableStudents.filter(student =>
                          (student.course || '').toUpperCase() === selectedCourse
                        );
                        return courseStudents.length > 0 && (
                          <button
                            onClick={async () => {
                              const studentIds = courseStudents.map(s => s.id);
                              try {
                                const res = await enrollAllStudentsToSubject(showStudentsModal, studentIds);
                                if (res?.ok) {
                                  // Reload available students
                                  await loadAvailableStudentsForSubject(showStudentsModal);
                                  const message = res.enrolled_count > 0
                                    ? `${res.enrolled_count} student(s) enrolled successfully${res.skipped_count > 0 ? ` (${res.skipped_count} already enrolled)` : ''}`
                                    : res.message || 'All students enrolled';
                                  setToast({ show: true, message, type: 'success' });
                                  setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
                                } else {
                                  setToast({ show: true, message: res?.message || 'Failed to enroll students', type: 'error' });
                                  setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
                                }
                              } catch (e) {
                                console.log('Enroll all students error', e);
                                const errorMsg = e?.response?.data?.message || 'Network error';
                                setToast({ show: true, message: errorMsg, type: 'error' });
                                setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
                              }
                            }}
                            className="px-3 lg:px-4 py-2 bg-rose-600 text-white text-xs lg:text-sm font-medium rounded-lg hover:bg-rose-700 transition-colors duration-200 flex items-center gap-1 lg:gap-2"
                          >
                            <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <span className="hidden sm:inline">Enroll All {selectedCourse} ({courseStudents.length})</span>
                            <span className="sm:hidden">Enroll All ({courseStudents.length})</span>
                          </button>
                        );
                      })()}
                      <button
                        onClick={() => {
                          setShowAddStudentsModal(false);
                          setAddStudentsSearchTerm(''); // Reset search when closing modal
                        }}
                        className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors duration-300 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
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
                              setAddStudentsSearchTerm(''); // Reset search when switching tabs
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

                  {/* Modal Body - Available Students Table grouped by Course and Section */}
                  <div className="flex-1 overflow-y-auto p-4 lg:p-6">
                    {(() => {
                      // Filter students by selected course tab
                      const courseMap = { bsit: 'BSIT', bscs: 'BSCS', bsemc: 'BSEMC' };
                      const selectedCourse = courseMap[addStudentsTab] || 'BSIT';
                      let courseStudents = availableStudents.filter(student =>
                        (student.course || '').toUpperCase() === selectedCourse
                      );

                      // Apply search filter if search term exists
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

                      // Group by section
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
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">
                                        Photo
                                      </th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">
                                        Name
                                      </th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">
                                        Email
                                      </th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">
                                        Student #
                                      </th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">
                                        Status
                                      </th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">
                                        Actions
                                      </th>
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
                                                <img
                                                  className="h-10 w-10 rounded-full object-cover border-2 border-rose-200 dark:border-rose-700"
                                                  src={profilePicUrl}
                                                  alt={student.full_name || 'Student'}
                                                  onError={(e) => {
                                                    e.target.style.display = 'none';
                                                    e.target.nextSibling.style.display = 'flex';
                                                  }}
                                                />
                                              ) : null}
                                              <div
                                                className={`h-10 w-10 rounded-full bg-gradient-to-br from-rose-100 to-red-100 dark:from-rose-900/30 dark:to-red-900/30 border-2 border-rose-200 dark:border-rose-700 flex items-center justify-center ${profilePicUrl ? 'hidden' : 'flex'}`}
                                              >
                                                <svg
                                                  className="h-6 w-6 text-rose-600 dark:text-rose-400"
                                                  fill="none"
                                                  stroke="currentColor"
                                                  viewBox="0 0 24 24"
                                                >
                                                  <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                                  />
                                                </svg>
                                              </div>
                                            </div>
                                          </td>
                                          <td className="px-6 py-4 whitespace-nowrap text-slate-800 dark:text-slate-100">
                                            {student.full_name || '-'}
                                          </td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-300">
                                            {student.email || '-'}
                                          </td>
                                          <td className="px-6 py-4 whitespace-nowrap text-slate-800 dark:text-slate-100">
                                            {student.student_number || '-'}
                                          </td>
                                          <td className="px-6 py-4 whitespace-nowrap">
                                            <span
                                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${student.is_active
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-200'
                                                }`}
                                            >
                                              {student.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                          </td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                            <button
                                              onClick={() => enrollStudent(student)}
                                              className="text-rose-600 hover:text-rose-900 dark:text-rose-400 dark:hover:text-rose-300"
                                            >
                                              Enroll
                                            </button>
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
            );
          })()
        }

        {/* Edit Account Modal */}
        {
          editUser && (
            <div
              className="fixed inset-0 bg-slate-900 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4 transition-opacity duration-300"
              onClick={() => setEditUser(null)}
            >
              <div
                className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col transform transition-all duration-300 scale-100 dark:bg-slate-900 dark:border dark:border-slate-800"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Edit Account</h3>
                    <p className="text-sm text-slate-600 mt-1 dark:text-slate-400">
                      {editUser.role === 'student' ? `Student Account - ${editUser.course || 'No Course'}` : editUser.role === 'teacher' ? 'Teacher Account' : 'Admin Account'}
                    </p>
                  </div>
                  <button
                    onClick={() => setEditUser(null)}
                    className="text-slate-400 hover:text-slate-600 transition-colors duration-300 p-2 hover:bg-slate-100 rounded-lg dark:hover:bg-slate-800"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Modal Body - Edit Form */}
                <div className="flex-1 overflow-y-auto p-6">
                  <form onSubmit={(e) => { e.preventDefault(); saveEdit(); }} className="space-y-6">
                    {/* Full Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={editUser.full_name || ''}
                        onChange={(e) => setEditUser({ ...editUser, full_name: e.target.value })}
                        className="w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-2 px-3 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100"
                        required
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={editUser.email || ''}
                        onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                        className="w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-2 px-3 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100"
                        required
                      />
                    </div>

                    {/* Status Toggle */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">
                        Account Status
                      </label>
                      <div className="flex items-center space-x-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="is_active"
                            checked={editUser.is_active === true}
                            onChange={() => setEditUser({ ...editUser, is_active: true })}
                            className="h-4 w-4 text-rose-600 focus:ring-rose-500 border-gray-300 dark:bg-slate-800"
                          />
                          <span className="ml-2 text-sm text-gray-700 dark:text-slate-300">Active</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="is_active"
                            checked={editUser.is_active === false}
                            onChange={() => setEditUser({ ...editUser, is_active: false })}
                            className="h-4 w-4 text-rose-600 focus:ring-rose-500 border-gray-300 dark:bg-slate-800"
                          />
                          <span className="ml-2 text-sm text-gray-700 dark:text-slate-300">Inactive</span>
                        </label>
                      </div>
                    </div>

                    {/* Student-specific fields */}
                    {(editUser.role === 'student' || editUser.course || editUser.student_number) && (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">
                              Course <span className="text-red-500">*</span>
                            </label>
                            <select
                              value={editUser.course || ''}
                              onChange={(e) => setEditUser({ ...editUser, course: e.target.value })}
                              className="w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-2 px-3 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100"
                              required
                            >
                              <option value="">Select course</option>
                              <option value="BSIT">BSIT</option>
                              <option value="BSCS">BSCS</option>
                              <option value="BSEMC">BSEMC</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">
                              Section <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={editUser.section || ''}
                              onChange={(e) => setEditUser({ ...editUser, section: e.target.value })}
                              className="w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-2 px-3 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100"
                              placeholder="Enter section (e.g., 3-Y1-1)"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">
                            Student Number
                          </label>
                          <input
                            type="text"
                            value={editUser.student_number || ''}
                            onChange={(e) => setEditUser({ ...editUser, student_number: e.target.value })}
                            className="w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-2 px-3 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100"
                            placeholder="Enter student number"
                          />
                        </div>
                      </>
                    )}

                    {/* Teacher-specific fields */}
                    {editUser.role === 'teacher' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">
                            Department
                          </label>
                          <input
                            type="text"
                            value={editUser.department || ''}
                            onChange={(e) => setEditUser({ ...editUser, department: e.target.value })}
                            className="w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-2 px-3 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100"
                            placeholder="Enter department"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">
                            Specialization
                          </label>
                          <input
                            type="text"
                            value={editUser.specialization || ''}
                            onChange={(e) => setEditUser({ ...editUser, specialization: e.target.value })}
                            className="w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-2 px-3 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100"
                            placeholder="Enter specialization"
                          />
                        </div>
                      </>
                    )}

                    {/* Form Actions */}
                    <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setEditUser(null)}
                        className="px-6 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className={`px-6 py-2 text-sm font-medium text-white rounded-lg transition-colors ${loading
                          ? 'bg-rose-400 cursor-not-allowed'
                          : 'bg-rose-600 hover:bg-rose-700'
                          }`}
                      >
                        {loading ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )
        }

        {/* Toast Notification */}
        <div
          className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ${toast.show ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3 pointer-events-none'
            }`}
        >
          <div className={`${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'} text-white px-5 py-3 rounded-lg shadow-lg flex items-center space-x-3`}>
            {toast.type === 'error' ? (
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            )}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </div>


      </div>
    </div>
  );
}



