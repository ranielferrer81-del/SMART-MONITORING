import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    getOnlineStudents,
    getStudentBrowserActivity,
    getIncognitoAlerts,
    eraseStudentMonitoringHistory,
    forceCloseStudentBrowser,
    forceCloseStudentTab,
    lockStudentPc,
    unlockStudentPc
} from '../api/browserMonitoring';
import { getApiBase } from '../config/apiBase';

const BrowserMonitoringDashboard = ({ userRole, enrolledStudents = [] }) => {
    const API_BASE = getApiBase();
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [selectedSection, setSelectedSection] = useState(null);
    const [students, setStudents] = useState([]);
    const [onlineStudents, setOnlineStudents] = useState([]);
    const [incognitoAlerts, setIncognitoAlerts] = useState([]);
    const [activityModalOpen, setActivityModalOpen] = useState(false);
    const [studentActivity, setStudentActivity] = useState([]);
    const [currentViewStudent, setCurrentViewStudent] = useState(null);
    const [tabCloseConfirm, setTabCloseConfirm] = useState(null);
    const [tabCloseNotice, setTabCloseNotice] = useState(null);
    const [isSendingTabClose, setIsSendingTabClose] = useState(false);
    const [lockModalTarget, setLockModalTarget] = useState(null);
    const [actionLoading, setActionLoading] = useState('');
    const [lockNotice, setLockNotice] = useState(null);

    // Poll online students and alerts
    useEffect(() => {
        const fetchStatus = async () => {
            const onlineResp = await getOnlineStudents();
            if (onlineResp.ok) setOnlineStudents(onlineResp.data);

            const alertsResp = await getIncognitoAlerts({ is_acknowledged: 0 });
            if (alertsResp.ok && alertsResp.data && alertsResp.data.data) {
                setIncognitoAlerts(alertsResp.data.data);
            }
        };

        fetchStatus();
        const interval = setInterval(fetchStatus, 5000); // 5s polling
        return () => clearInterval(interval);
    }, []);

    const isStudentOnline = (studentId) => {
        return onlineStudents.some(s => s.id === studentId);
    };

    const hasIncognitoAlert = (studentId) => {
        return incognitoAlerts.some(a => a.student_user_id === studentId && !a.is_acknowledged);
    };

    const requestTabClose = (student, log) => {
        setTabCloseConfirm({ student, log });
    };

    const submitTabClose = async () => {
        if (!tabCloseConfirm || isSendingTabClose) return;

        const { student, log } = tabCloseConfirm;
        setIsSendingTabClose(true);
        try {
            const result = await forceCloseStudentTab(student.id, log.id, log.url);
            if (result.ok) {
                setStudentActivity(prev => prev.filter(item => item.id !== log.id));
                setTabCloseNotice({
                    type: 'success',
                    message: 'Tab close command sent. The tab will close within 5 seconds.',
                });
            } else {
                setTabCloseNotice({
                    type: 'error',
                    message: `Failed to close tab: ${result.error || 'Unknown error'}`,
                });
            }
        } catch (error) {
            setTabCloseNotice({
                type: 'error',
                message: `Error closing tab: ${error.message}`,
            });
        } finally {
            setIsSendingTabClose(false);
            setTabCloseConfirm(null);
        }
    };

    const handleLockSubmit = async (computerName, message) => {
        if (!computerName) return;
        setActionLoading(computerName);
        try {
            const res = await lockStudentPc(computerName, message);
            if (res.ok) {
                setOnlineStudents(prev =>
                    prev.map(s => (s.computer_name === computerName ? { ...s, is_locked: true, lock_message: message } : s))
                );
                setLockNotice({
                    type: 'success',
                    message: `PC ${computerName} is now locked.`,
                });
                setLockModalTarget(null);
            } else {
                setLockNotice({
                    type: 'error',
                    message: `Failed to lock PC: ${res.error || 'Unknown error'}`,
                });
            }
        } catch (err) {
            setLockNotice({
                type: 'error',
                message: `Error locking PC: ${err.message}`,
            });
        } finally {
            setActionLoading('');
        }
    };

    const handleUnlockClick = async (computerName) => {
        if (!computerName) return;
        setActionLoading(computerName);
        try {
            const res = await unlockStudentPc(computerName);
            if (res.ok) {
                setOnlineStudents(prev =>
                    prev.map(s => (s.computer_name === computerName ? { ...s, is_locked: false, lock_message: null } : s))
                );
                setLockNotice({
                    type: 'success',
                    message: `PC ${computerName} has been unlocked.`,
                });
            } else {
                setLockNotice({
                    type: 'error',
                    message: `Failed to unlock PC: ${res.error || 'Unknown error'}`,
                });
            }
        } catch (err) {
            setLockNotice({
                type: 'error',
                message: `Error unlocking PC: ${err.message}`,
            });
        } finally {
            setActionLoading('');
        }
    };

    const handleViewActivity = async (student) => {
        setCurrentViewStudent(student);
        setActivityModalOpen(true);
        const resp = await getStudentBrowserActivity(student.id);
        if (resp.ok && resp.data && resp.data.data) {
            setStudentActivity(resp.data.data);
        } else {
            setStudentActivity([]);
        }
    };


    // Group students by course and section
    const groupedStudents = enrolledStudents.reduce((acc, student) => {
        const course = student.course || 'Unknown';
        const section = student.section || 'No Section';

        if (!acc[course]) {
            acc[course] = {};
        }
        if (!acc[course][section]) {
            acc[course][section] = [];
        }
        acc[course][section].push(student);
        return acc;
    }, {});

    // Get courses
    const courses = Object.keys(groupedStudents).sort();

    // Handle course selection
    const handleCourseClick = (course) => {
        setSelectedCourse(course);
        setSelectedSection(null);
        setStudents([]);
    };

    // Handle section selection
    const handleSectionClick = (section) => {
        setSelectedSection(section);
        if (selectedCourse && groupedStudents[selectedCourse][section]) {
            setStudents(groupedStudents[selectedCourse][section]);
        }
    };

    // Go back to course view
    const goBack = () => {
        if (selectedSection) {
            setSelectedSection(null);
            setStudents([]);
        } else if (selectedCourse) {
            setSelectedCourse(null);
        }
    };

    return (
        <div className="min-w-0 space-y-6">
            {(selectedCourse || selectedSection) && (
                <div className="flex justify-end">
                    <button
                        onClick={goBack}
                        className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/50 px-4 py-2 text-sm font-medium text-slate-800 shadow-sm backdrop-blur-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100 dark:hover:bg-slate-700"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back
                    </button>
                </div>
            )}

            {/* Breadcrumb */}
            <div className="inline-flex w-full min-w-0 max-w-full flex-wrap items-center gap-2 rounded-xl border border-slate-200/60 bg-white/30 px-3 py-2 text-sm text-slate-600 shadow-sm backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-900/30 dark:text-slate-400">
                <span className={!selectedCourse ? 'font-semibold text-rose-600 dark:text-rose-400' : 'cursor-pointer hover:text-rose-600'} onClick={() => { setSelectedCourse(null); setSelectedSection(null); setStudents([]); }}>
                    Courses
                </span>
                {selectedCourse && (
                    <>
                        <span>/</span>
                        <span className={!selectedSection ? 'font-semibold text-rose-600 dark:text-rose-400' : 'cursor-pointer hover:text-rose-600'} onClick={() => { setSelectedSection(null); setStudents([]); }}>
                            {selectedCourse}
                        </span>
                    </>
                )}
                {selectedSection && (
                    <>
                        <span>/</span>
                        <span className="font-semibold text-rose-600 dark:text-rose-400">
                            {selectedSection}
                        </span>
                    </>
                )}
            </div>

            {/* Course View */}
            {!selectedCourse && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {courses.map((course) => {
                        const sectionCount = Object.keys(groupedStudents[course]).length;
                        const studentCount = Object.values(groupedStudents[course]).reduce((sum, students) => sum + students.length, 0);

                        return (
                            <div
                                key={course}
                                onClick={() => handleCourseClick(course)}
                                className="cursor-pointer rounded-2xl border border-slate-200/70 bg-white/15 p-6 shadow-md backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-rose-400/80 hover:shadow-xl dark:border-slate-700/60 dark:bg-slate-900/40 dark:hover:border-rose-500/60"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-3xl font-bold text-rose-600 dark:text-rose-400">
                                        {course}
                                    </h3>
                                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                                <div className="space-y-2 text-slate-700 dark:text-slate-300">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                        </svg>
                                        <span className="font-medium">{sectionCount} Section{sectionCount !== 1 ? 's' : ''}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                        </svg>
                                        <span className="font-medium">{studentCount} Student{studentCount !== 1 ? 's' : ''}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Section View */}
            {selectedCourse && !selectedSection && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.keys(groupedStudents[selectedCourse]).sort().map((section) => {
                        const studentCount = groupedStudents[selectedCourse][section].length;

                        return (
                            <div
                                key={section}
                                onClick={() => handleSectionClick(section)}
                                className="bg-white/10 backdrop-blur-sm border-2 border-slate-200/60 dark:border-slate-800/60 rounded-xl p-5 cursor-pointer hover:border-rose-400 dark:hover:border-rose-600 hover:shadow-lg transition-all duration-300"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-xl font-bold text-slate-800 dark:text-slate-50 mb-1">
                                            Section {section}
                                        </h4>
                                        <p className="text-sm text-slate-600 dark:text-slate-400">
                                            {studentCount} student{studentCount !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                    <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Student List View */}
            {selectedSection && students.length > 0 && (
                <div className="bg-white/10 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60 rounded-2xl overflow-hidden min-w-0">
                    <div className="p-4 sm:p-6 border-b border-slate-200/60 dark:border-slate-800/60">
                        <h3 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-50">
                            {selectedCourse} - Section {selectedSection}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                            {students.length} enrolled student{students.length !== 1 ? 's' : ''}
                        </p>
                    </div>

                    <div className="overflow-x-auto w-full overflow-x-scroll">
                        <table className="w-full min-w-[720px]">
                            <thead className="bg-slate-100/50 dark:bg-slate-800/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                        Student
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                        Email
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                        Student Number
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                        Computer
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                        Lab Room
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/50 dark:divide-slate-700/50">
                                {students.map((student) => {
                                    // Get computer info from online students data
                                    const onlineInfo = onlineStudents.find(s => s.id === student.id);
                                    const computerName = onlineInfo?.display_name || onlineInfo?.computer_name || null;
                                    const fallbackUnknownLab = onlineInfo?.gateway_ip
                                        ? `Unknown Lab (${onlineInfo.gateway_ip})`
                                        : 'Unknown Lab';
                                    const labRoom = onlineInfo?.laboratory_room || fallbackUnknownLab;

                                    return (
                                        <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    {student.profile_picture ? (
                                                        <img
                                                            src={`${API_BASE}${student.profile_picture}`}
                                                            alt={student.full_name || 'Student'}
                                                            className="h-10 w-10 rounded-full object-cover border-2 border-rose-200 dark:border-rose-700"
                                                            onError={(e) => {
                                                                // Fallback to initials if image fails to load
                                                                e.target.style.display = 'none';
                                                                e.target.nextSibling.style.display = 'flex';
                                                            }}
                                                        />
                                                    ) : null}
                                                    <div
                                                        className="h-10 w-10 rounded-full bg-gradient-to-br from-rose-100 to-red-100 dark:from-rose-900/30 dark:to-red-900/30 border-2 border-rose-200 dark:border-rose-700 flex items-center justify-center"
                                                        style={{ display: student.profile_picture ? 'none' : 'flex' }}
                                                    >
                                                        <span className="text-rose-600 dark:text-rose-400 font-bold">
                                                            {student.full_name?.charAt(0) || 'S'}
                                                        </span>
                                                    </div>
                                                    <div className="ml-4">
                                                        <div className="text-sm font-medium text-slate-900 dark:text-slate-50">
                                                            {student.full_name}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
                                                {student.email}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
                                                {student.student_number || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                {isStudentOnline(student.id) && computerName ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 dark:bg-slate-900/20 text-red-700 dark:text-red-300 font-mono text-xs border border-slate-200 dark:border-slate-800">
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                        </svg>
                                                        {computerName}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 dark:text-slate-500">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                {isStudentOnline(student.id) ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 dark:bg-slate-900/20 text-red-700 dark:text-red-300 font-medium text-xs border border-red-200 dark:border-red-800">
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        </svg>
                                                        {labRoom}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 dark:text-slate-500">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {isStudentOnline(student.id) ? (
                                                    <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800 border border-red-200">
                                                        Online
                                                    </span>
                                                ) : (
                                                    <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                                                        Offline
                                                    </span>
                                                )}
                                                {onlineInfo?.is_locked && (
                                                    <span className="ml-2 px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-full bg-red-600 text-white animate-pulse shadow-sm">
                                                        🔒 Locked
                                                    </span>
                                                )}
                                                {hasIncognitoAlert(student.id) && (
                                                    <span className="ml-2 px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800 border border-red-200 animate-pulse">
                                                        Incognito Alert
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleViewActivity(student)}
                                                        className="text-rose-600 hover:text-rose-900 dark:text-rose-400 dark:hover:text-rose-300 font-medium text-xs px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                                                    >
                                                        View Activity
                                                    </button>
                                                    {isStudentOnline(student.id) && computerName && (
                                                        onlineInfo?.is_locked ? (
                                                            <button
                                                                onClick={() => handleUnlockClick(computerName)}
                                                                disabled={actionLoading === computerName}
                                                                className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white shadow-sm transition-colors disabled:opacity-50"
                                                                title="Unlock this student PC"
                                                            >
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                                                                </svg>
                                                                {actionLoading === computerName ? '…' : 'Unlock'}
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => setLockModalTarget({ student, computer_name: computerName })}
                                                                disabled={actionLoading === computerName}
                                                                className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-colors disabled:opacity-50"
                                                                title="Lock this student PC"
                                                            >
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                                </svg>
                                                                Lock
                                                            </button>
                                                        )
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!selectedCourse && courses.length === 0 && (
                <div className="text-center py-12">
                    <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-50">No students found</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        No enrolled students available for monitoring.
                    </p>
                </div>
            )}

            {activityModalOpen && currentViewStudent && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md overflow-y-auto">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800">
                        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <h3 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-50 truncate">
                                    Activity for {currentViewStudent.full_name}
                                </h3>
                                {(() => {
                                    const activeInfo = onlineStudents.find(s => s.id === currentViewStudent.id);
                                    return activeInfo?.is_locked ? (
                                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white uppercase tracking-wider animate-pulse flex-shrink-0">
                                            🔒 Locked
                                        </span>
                                    ) : null;
                                })()}
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 flex-shrink-0">
                                {(() => {
                                    const activeInfo = onlineStudents.find(s => s.id === currentViewStudent.id);
                                    const pcName = activeInfo?.display_name || activeInfo?.computer_name;
                                    if (!pcName) return null;

                                    return activeInfo?.is_locked ? (
                                        <button
                                            type="button"
                                            onClick={() => handleUnlockClick(pcName)}
                                            disabled={actionLoading === pcName}
                                            className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-xs sm:text-sm transition-colors shadow-md disabled:opacity-50"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                                            </svg>
                                            <span>{actionLoading === pcName ? 'Unlocking…' : 'Unlock PC'}</span>
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setLockModalTarget({ student: currentViewStudent, computer_name: pcName })}
                                            disabled={actionLoading === pcName}
                                            className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold text-xs sm:text-sm transition-colors shadow-md disabled:opacity-50"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                            </svg>
                                            <span>Lock PC</span>
                                        </button>
                                    );
                                })()}
                                {userRole === 'admin' && (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if (!window.confirm(`Permanently erase stored monitoring history for ${currentViewStudent.full_name}?\n\nThis removes saved log rows from the system only.\nIt does NOT close any tabs or the browser.`)) {
                                                return;
                                            }
                                            try {
                                                const result = await eraseStudentMonitoringHistory(currentViewStudent.id);
                                                if (result.ok) {
                                                    setStudentActivity([]);
                                                    const n = result.data?.deleted_count ?? 0;
                                                    alert(`History erased.\n\n${n} record(s) removed from storage. The student’s tabs stay open.`);
                                                } else {
                                                    alert(result.error || 'Failed to erase history');
                                                }
                                            } catch (e) {
                                                alert(e.message || 'Failed to erase history');
                                            }
                                        }}
                                        className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold text-sm sm:text-base transition-colors shadow-md"
                                        title="Delete stored monitoring log from the server; does not close student tabs"
                                    >
                                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        <span className="hidden sm:inline">Erase</span>
                                    </button>
                                )}
                                <button
                                    onClick={async () => {
                                        if (!window.confirm(`Are you sure you want to close ${currentViewStudent.full_name}'s browser and delete ALL their browsing history?\n\nThis will:\n- Close their entire browser\n- Delete all browsing history from the system\n- Free up database space`)) {
                                            return;
                                        }
                                        try {
                                            const result = await forceCloseStudentBrowser(currentViewStudent.id);
                                            if (result.ok) {
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
                                    className="flex items-center space-x-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 text-sm sm:text-base"
                                >
                                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                    <span className="hidden sm:inline">Exit Browser</span>
                                </button>
                                <button onClick={() => setActivityModalOpen(false)} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>
                        {tabCloseNotice && (
                            <div className={`mx-4 sm:mx-6 mt-4 rounded-lg border px-4 py-3 text-sm ${
                                tabCloseNotice.type === 'success'
                                    ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300'
                                    : 'border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300'
                            }`}>
                                <div className="flex items-center justify-between gap-3">
                                    <span>{tabCloseNotice.message}</span>
                                    <button
                                        type="button"
                                        onClick={() => setTabCloseNotice(null)}
                                        className="text-xs font-semibold uppercase tracking-wide opacity-80 hover:opacity-100"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            </div>
                        )}
                        <div className="flex-1 overflow-auto p-0 w-full">
                            <div className="w-full overflow-x-auto">
                                <table className="w-full min-w-[800px]">
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
                                                            onClick={() => requestTabClose(currentViewStudent, log)}
                                                            className="inline-flex items-center px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold rounded-lg transition-all duration-200 shadow hover:shadow-md transform hover:scale-105"
                                                            title="Close this tab on student's browser"
                                                        >
                                                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                            Close
                                                        </button>
                                                    </td>
                                                    <td className="px-4 sm:px-6 py-4 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                                        {new Date(log.visit_timestamp).toLocaleTimeString()}
                                                    </td>
                                                    <td className="px-4 sm:px-6 py-4 text-sm text-slate-800 dark:text-slate-200 font-mono break-all whitespace-normal max-w-xs sm:max-w-md xl:max-w-xl" title={log.url}>
                                                        <a href={log.url} target="_blank" rel="noopener noreferrer" className="text-rose-600 hover:text-rose-700 hover:underline dark:text-rose-400 dark:hover:text-rose-300">
                                                            {log.url}
                                                        </a>
                                                    </td>
                                                    <td className="px-4 sm:px-6 py-4 text-sm text-slate-600 dark:text-slate-400 break-words whitespace-normal max-w-xs sm:max-w-sm">
                                                        {log.page_title}
                                                    </td>

                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                                    No activity recorded yet
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {tabCloseConfirm && createPortal(
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4">
                    <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
                        <div className="p-5 border-b border-slate-200 dark:border-slate-800">
                            <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                Close This Tab?
                            </h4>
                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 break-all">
                                {tabCloseConfirm.log.url}
                            </p>
                            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                Student: <span className="font-semibold">{tabCloseConfirm.student.full_name}</span>
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                The tab will close within 5 seconds after sending.
                            </p>
                        </div>
                        <div className="p-4 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setTabCloseConfirm(null)}
                                disabled={isSendingTabClose}
                                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={submitTabClose}
                                disabled={isSendingTabClose}
                                className="px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60"
                            >
                                {isSendingTabClose ? 'Sending...' : 'Send Close Command'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Lock PC Modal Portal */}
            {lockModalTarget && createPortal(
                <div
                    className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fadeIn"
                    onClick={() => setLockModalTarget(null)}
                    role="presentation"
                >
                    <div
                        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 relative text-left"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Lock Student PC</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Show lock screen overlay on student's computer
                                </p>
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 mb-4 border border-slate-200/80 dark:border-slate-700 text-xs space-y-1.5">
                            <div className="flex justify-between">
                                <span className="text-slate-500 dark:text-slate-400 font-medium">Student:</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                                    {lockModalTarget.student?.full_name || 'Student'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 dark:text-slate-400 font-medium">Computer:</span>
                                <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                                    {lockModalTarget.computer_name}
                                </span>
                            </div>
                        </div>

                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                const msg = e.target.elements.message.value;
                                handleLockSubmit(lockModalTarget.computer_name, msg.trim());
                            }}
                            className="space-y-4"
                        >
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                                    Lock Message (Displayed to student)
                                </label>
                                <textarea
                                    name="message"
                                    rows={3}
                                    defaultValue="This PC has been locked by your instructor."
                                    placeholder="Enter message for student screen..."
                                    className="w-full text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 resize-none"
                                    maxLength={500}
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                                <button
                                    type="button"
                                    onClick={() => setLockModalTarget(null)}
                                    disabled={actionLoading === lockModalTarget.computer_name}
                                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading === lockModalTarget.computer_name}
                                    className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md transition-colors flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    {actionLoading === lockModalTarget.computer_name ? (
                                        <>
                                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            Locking…
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                            </svg>
                                            Lock PC
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default BrowserMonitoringDashboard;


