import React, { useState, useEffect } from 'react';
import { createAccount, fetchTeachers, fetchAllStudents, fetchStudentsByCourse, updateAccount, deleteAccount, listSubjects, getSubjectEnrolledStudents, enrollStudentToSubject, unenrollStudentFromSubject } from '../../api/client';
import { getStudentBrowserActivity, getRealtimeBrowserActivity, getIncognitoAlerts, acknowledgeIncognitoAlert, startMonitoringSession, endMonitoringSession, getMonitoringSessions } from '../../api/browserMonitoring';
import ThemeToggle from '../../components/ThemeToggle';
import BrowserMonitoringDashboard from '../BrowserMonitoringDashboard';
import ScreenMonitoringSection from '../ScreenMonitoringSection';
import StudentsTimeClockSection from '../StudentsTimeClockSection';

// Extracted components
import AccountManagementSection from './sections/AccountManagementSection';
import AddAccountSection from './sections/AddAccountSection';
import SubjectCardsSection from './sections/SubjectCardsSection';
import SubjectManagementSection from './sections/SubjectManagementSection';
import EditAccountModal from './modals/EditAccountModal';
import StaffDashboardSettings from '../StaffDashboardSettings';
import { EnrolledStudentsModal, AddStudentsModal } from './modals/SubjectManagementModals';
import { getAdminDefaultAccountsTab, setAdminDefaultAccountsTab, getAdminConfirmBeforeDelete } from '../../utils/dashboardPrefs';
import { getApiBase } from '../../config/apiBase';

export default function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState(() => getAdminDefaultAccountsTab());
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
  const [newSubject, setNewSubject] = useState({
    code: '',
    name: '',
    course: '',
    section: '',
    teacher_user_id: '',
    day_of_week: '1',
    start_time: '08:00',
    end_time: '10:00',
    late_grace_minutes: '15',
  });
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

  const setTabAndPersist = (t) => {
    setTab(t);
    setAdminDefaultAccountsTab(t);
  };

  const handleDeleteAccount = async (accountId) => {
    if (getAdminConfirmBeforeDelete() && !window.confirm('Are you sure you want to delete this account?')) return;
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

    // Base64 data URL - return as-is (from upload response)
    if (profilePicture.startsWith('data:')) {
      return profilePicture;
    }

    // If it's already a full URL, return it
    if (profilePicture.startsWith('http')) {
      return profilePicture;
    }

    // Otherwise, construct the full URL
    const apiBase = getApiBase();
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
    <div className="relative flex h-[100dvh] min-h-0 w-full max-w-[100vw] overflow-hidden">
      {/* ── Background ─────────────────────────────── */}
      <div aria-hidden className="admin-aurora pointer-events-none absolute inset-0 -z-10" />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-dotgrid opacity-60" />
        <div className="absolute -top-32 -left-32 h-[30rem] w-[30rem] rounded-full bg-rose-400/40 mix-blend-multiply blur-3xl animate-blob" />
        <div className="absolute -top-20 right-0 h-[28rem] w-[28rem] rounded-full bg-slate-400/35 mix-blend-multiply blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute -bottom-32 left-1/3 h-[26rem] w-[26rem] rounded-full bg-slate-400/30 mix-blend-multiply blur-3xl animate-blob animation-delay-4000" />
      </div>
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden animate-fade-in-slow"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────── */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-[min(100vw-2rem,280px)] sm:w-80 lg:w-72 lg:max-h-[95vh] lg:h-[95vh] lg:my-auto lg:ml-6
        max-h-[100dvh] overflow-hidden
        glass-strong lg:rounded-[1.75rem]
        transform transition-all duration-500 cubic-bezier(0.22,1,0.36,1)
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Left accent bar */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-rose-500 via-red-500 to-red-500 opacity-95" aria-hidden />
        <div className="h-full overflow-y-auto p-4 lg:p-6 pl-5 lg:pl-7">
          <div className="mb-6 flex items-center justify-between lg:mb-8">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-rose-500/40 via-red-500/30 to-red-500/40 blur-lg opacity-70" aria-hidden />
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/80 p-1.5 shadow-soft ring-1 ring-white/80 dark:bg-slate-800/70 dark:ring-white/10 lg:h-12 lg:w-12 backdrop-blur">
                  <img src={`${process.env.PUBLIC_URL}/favicon.svg`} alt="" className="h-full w-full object-contain" />
                </div>
              </div>
              <div>
                <h1 className="text-red-700 dark:text-red-400 text-lg font-extrabold tracking-tight lg:text-xl">
                  S.M.A.R.T
                </h1>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Admin Console</p>
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

          <nav className="space-y-1.5">
            {[
              { id: 'accounts',        label: 'Account Management', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z' },
              { id: 'add-account',     label: 'Add New Account',      icon: 'M12 6v6m0 0v6m0-6h6m-6 0H6' },
              { id: 'subjects',        label: 'Subject List',         icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 19.477 5.754 20 7.5 20s3.332-.477 4.5-1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 19.477 18.247 20 16.5 20c-1.746 0-3.332-.477-4.5-1.253' },
              { id: 'monitoring',      label: 'Browser Monitoring',   icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
              { id: 'screen-monitoring', label: 'Screen Monitoring',  icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
              { id: 'time-clock',      label: 'Students time-in / out', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
              { id: 'manage-subjects', label: 'Create Subject',       icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
              { id: 'settings',        label: 'Settings',             icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
            ].map((item) => {
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { setActiveSection(item.id); setMobileMenuOpen(false); }}
                  className={`group relative flex w-full items-center rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-300 ease-out overflow-hidden
                    ${active
                      ? 'text-white shadow-glow bg-gradient-to-r from-rose-500 via-red-500 to-red-500 bg-size-200 animate-gradient-shift'
                      : 'text-slate-700 hover:bg-white/70 hover:text-rose-600 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-rose-300 hover:translate-x-0.5 hover:shadow-soft'
                    }`}
                >
                  <span className={`mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300
                    ${active
                      ? 'bg-white/20 text-white shadow-inner'
                      : 'bg-rose-50 text-rose-500 group-hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:group-hover:bg-rose-900/50'
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
              <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-rose-500 via-red-500 to-rose-400 opacity-30 blur-md group-hover:opacity-50 transition-opacity duration-300" aria-hidden />
              <button
                onClick={handleLogout}
                className="relative w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-white rounded-2xl bg-gradient-to-r from-rose-500 via-red-500 to-rose-400 shadow-[0_8px_24px_-8px_rgba(244,63,94,0.5)] hover:shadow-[0_12px_32px_-8px_rgba(244,63,94,0.7)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 overflow-hidden"
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
                      <span className="hidden h-8 w-1 shrink-0 rounded-full bg-gradient-to-b from-rose-500 via-red-500 to-rose-600 shadow-[0_0_12px_rgba(244,63,94,0.5)] lg:block" aria-hidden />
                      <h2 className="truncate text-xl font-bold tracking-tight text-transparent bg-gradient-to-r from-rose-600 to-red-600 bg-clip-text dark:from-rose-400 dark:to-red-400 lg:text-3xl">
                        {activeSection === 'accounts'
                          ? 'Account Management'
                          : activeSection === 'add-account'
                            ? 'Add New Account'
                            : activeSection === 'manage-subjects'
                              ? 'Create Subject'
                              : activeSection === 'monitoring'
                                ? 'Browser Monitoring'
                                : activeSection === 'screen-monitoring'
                                  ? 'Screen Monitoring'
                                : activeSection === 'time-clock'
                                  ? 'Students time-in / time-out'
                                  : activeSection === 'settings'
                                    ? 'Settings'
                                    : 'Subject List'}
                      </h2>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs font-medium text-slate-700 dark:text-slate-200 lg:text-sm">
                      {activeSection === 'accounts' && 'Search, filter, and manage professor and student accounts in one place.'}
                      {activeSection === 'add-account' && 'Create a new user with the right role, credentials, and course details.'}
                      {activeSection === 'subjects' && 'View subjects, sections, enrolled students, and open monitoring context.'}
                      {activeSection === 'manage-subjects' && 'Create subjects, assign professors, and set class schedule.'}
                      {activeSection === 'monitoring' && 'Pick a course and section to view live browser activity and sessions.'}
                      {activeSection === 'screen-monitoring' && 'View live desktop thumbnails from all online lab PCs (Desktop App).'}
                      {activeSection === 'time-clock' && 'Browse all students by course and section; open date-based PC sign-in and sign-out history.'}
                      {activeSection === 'settings' && 'Your account, password, position title, account-management defaults, and delete confirmations.'}
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
                      <span className="font-bold text-red-700 dark:text-red-400">{user?.fullName || user?.full_name || 'Admin'}</span>
                    </div>
                  </div>
                  <div className="relative group">
                    <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-red-500 via-rose-500 to-rose-500 opacity-0 group-hover:opacity-40 blur transition-opacity duration-300" aria-hidden />
                    <button
                      type="button"
                      onClick={() => loadAllLists(true)}
                      disabled={loading}
                      className="relative flex items-center gap-2 rounded-2xl bg-gradient-to-r from-red-500 via-rose-500 to-rose-600 bg-size-200 animate-gradient-shift px-4 py-2.5 text-xs font-bold text-white shadow-glow hover:scale-[1.03] active:scale-[0.97] disabled:scale-100 disabled:opacity-70 transition-all duration-300 lg:text-sm"
                      title="Refresh all data"
                    >
                      <svg className={`h-4 w-4 shrink-0 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span className="hidden lg:inline">{loading ? 'Refreshing...' : 'Refresh'}</span>
                    </button>
                  </div>
                  <ThemeToggle />
                  <div className="relative group">
                    <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-rose-500 via-red-500 to-rose-400 opacity-0 group-hover:opacity-40 blur transition-opacity duration-300" aria-hidden />
                    <button
                      type="button"
                      onClick={handleLogout}
                      title="Logout"
                      className="relative flex items-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 via-red-500 to-rose-400 bg-size-200 animate-gradient-shift px-4 py-2.5 text-xs font-bold text-white shadow-glow hover:scale-[1.03] active:scale-[0.97] transition-all duration-300 lg:text-sm"
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
            {loading && (
              <div className="absolute inset-0 z-50 flex items-center justify-center animate-fade-in-slow">
                <div className="absolute inset-0 glass-strong" />
                <div className="relative flex flex-col items-center">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full border-4 border-rose-500/30 animate-pulse-ring" />
                    <div className="relative h-16 w-16 animate-spin rounded-full border-[3px] border-transparent border-t-red-500 border-r-rose-500 border-b-red-700 shadow-glow" />
                  </div>
                  <p className="mt-6 text-sm font-bold text-red-600 dark:text-red-400 lg:text-base">Loading data...</p>
                </div>
              </div>
            )}

            <div className="mx-auto w-full min-w-0 max-w-[1600px]">
          {/* ── Account Management Section ── */}
          {activeSection === 'accounts' && (
            <AccountManagementSection
              tab={tab} setTab={setTabAndPersist}
              searchTerm={searchTerm} setSearchTerm={setSearchTerm}
              teachers={teachers}
              studentsBSIT={studentsBSIT} studentsBSCS={studentsBSCS} studentsBSEMC={studentsBSEMC}
              filterAccounts={filterAccounts}
              groupStudentsBySection={groupStudentsBySection}
              mergeCustomSectionsIntoGroups={mergeCustomSectionsIntoGroups}
              getProfilePictureUrl={getProfilePictureUrl}
              openEdit={openEdit}
              handleDeleteAccount={handleDeleteAccount}
              newSection={newSection} setNewSection={setNewSection}
              handleAddSection={handleAddSection}
            />
          )}

          {/* ── Add Account Section ── */}
          {activeSection === 'add-account' && (
            <AddAccountSection
              form={form} setForm={setForm}
              formErrors={formErrors} setFormErrors={setFormErrors}
              creating={creating}
              submitCreateAccount={submitCreateAccount}
            />
          )}

          {/* ── Subject Cards Section ── */}
          {activeSection === 'subjects' && (
            <SubjectCardsSection
              subjects={subjects}
              enrolledStudents={enrolledStudents}
              refreshSubjects={refreshSubjects}
              setShowStudentsModal={setShowStudentsModal}
              setActiveSection={setActiveSection}
            />
          )}

          {activeSection === 'time-clock' && <StudentsTimeClockSection />}

          {/* ── Browser Monitoring Section ── */}
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

          {activeSection === 'screen-monitoring' && (
            <div className="space-y-6">
              <ScreenMonitoringSection />
            </div>
          )}

          {/* ── Manage Subjects Section ── */}
          {activeSection === 'manage-subjects' && (
            <SubjectManagementSection
              subjects={subjects}
              refreshSubjects={refreshSubjects}
              newSubject={newSubject} setNewSubject={setNewSubject}
              subErrors={subErrors} setSubErrors={setSubErrors}
              teachers={teachers}
              getAvailableSections={getAvailableSections}
              setToast={setToast}
            />
          )}

          {activeSection === 'settings' && user && (
            <StaffDashboardSettings
              role="admin"
              user={user}
              setUser={setUser}
              adminAccountsTab={tab}
              setAdminAccountsTab={setTabAndPersist}
            />
          )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Enrolled Students Modal ── */}
      <EnrolledStudentsModal
        showStudentsModal={showStudentsModal}
        setShowStudentsModal={setShowStudentsModal}
        subjects={subjects}
        enrolledStudents={enrolledStudents}
        unenrollStudent={unenrollStudent}
        loadAvailableStudentsForSubject={loadAvailableStudentsForSubject}
      />

      {/* ── Add Students Modal ── */}
      <AddStudentsModal
        showAddStudentsModal={showAddStudentsModal}
        setShowAddStudentsModal={setShowAddStudentsModal}
        showStudentsModal={showStudentsModal}
        subjects={subjects}
        availableStudents={availableStudents}
        addStudentsTab={addStudentsTab} setAddStudentsTab={setAddStudentsTab}
        addStudentsSearchTerm={addStudentsSearchTerm} setAddStudentsSearchTerm={setAddStudentsSearchTerm}
        enrollStudent={enrollStudent}
        loadAvailableStudentsForSubject={loadAvailableStudentsForSubject}
        groupStudentsBySection={groupStudentsBySection}
        getProfilePictureUrl={getProfilePictureUrl}
        setToast={setToast}
      />

      {/* ── Edit Account Modal ── */}
      <EditAccountModal
        editUser={editUser}
        setEditUser={setEditUser}
        saveEdit={saveEdit}
        loading={loading}
      />

      {/* Toast Notification */}
      <div
        className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ${toast.show ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3 pointer-events-none'
          }`}
      >
        <div className={`${toast.type === 'error' ? 'bg-red-600' : 'bg-red-600'} text-white px-5 py-3 rounded-lg shadow-lg flex items-center space-x-3`}>
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
  );
}



