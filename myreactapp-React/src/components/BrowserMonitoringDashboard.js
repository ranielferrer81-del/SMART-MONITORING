import React, { useState, useEffect } from 'react';
import {
    getOnlineStudents,
    getStudentBrowserActivity,
    getIncognitoAlerts
} from '../api/browserMonitoring';

const BrowserMonitoringDashboard = ({ userRole, enrolledStudents = [] }) => {
    const API_BASE = process.env.REACT_APP_API_BASE || 'http://127.0.0.1:8000';
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [selectedSection, setSelectedSection] = useState(null);
    const [students, setStudents] = useState([]);
    const [onlineStudents, setOnlineStudents] = useState([]);
    const [incognitoAlerts, setIncognitoAlerts] = useState([]);
    const [activityModalOpen, setActivityModalOpen] = useState(false);
    const [studentActivity, setStudentActivity] = useState([]);
    const [currentViewStudent, setCurrentViewStudent] = useState(null);

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
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-50">
                        Browser Monitoring
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Select a course and section to view student monitoring status
                    </p>
                </div>
                {(selectedCourse || selectedSection) && (
                    <button
                        onClick={goBack}
                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-50 rounded-lg transition-colors flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back
                    </button>
                )}
            </div>

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
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
                                className="bg-white/10 backdrop-blur-sm border-2 border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-6 cursor-pointer hover:border-rose-400 dark:hover:border-rose-600 hover:shadow-xl transition-all duration-300 transform hover:scale-105"
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

                    <div className="overflow-x-auto w-full">
                        <table className="w-full">
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
                                    const computerName = onlineInfo?.computer_name || null;
                                    const labRoom = onlineInfo?.laboratory_room || null;

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
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-mono text-xs border border-blue-200 dark:border-blue-800">
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
                                                {isStudentOnline(student.id) && labRoom ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 font-medium text-xs border border-purple-200 dark:border-purple-800">
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
                                                    <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 border border-green-200">
                                                        Online
                                                    </span>
                                                ) : (
                                                    <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                                                        Offline
                                                    </span>
                                                )}
                                                {hasIncognitoAlert(student.id) && (
                                                    <span className="ml-2 px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800 border border-red-200 animate-pulse">
                                                        Incognito Alert
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <button
                                                    onClick={() => handleViewActivity(student)}
                                                    className="text-rose-600 hover:text-rose-900 dark:text-rose-400 dark:hover:text-rose-300 font-medium"
                                                >
                                                    View Activity
                                                </button>
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

            {/* Activity Modal */}
            {activityModalOpen && currentViewStudent && (
                <div className="fixed inset-0 z-[100] flex items-start justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm pt-8 sm:pt-20">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700">
                        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 gap-2">
                            <h3 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-50 min-w-0 truncate">
                                Activity for {currentViewStudent.full_name}
                            </h3>
                            <button onClick={() => setActivityModalOpen(false)} className="flex-shrink-0 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 p-2">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-0">
                            <table className="w-full min-w-max">
                                <thead className="bg-slate-50 dark:bg-slate-900 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-700 sticky top-0">
                                    <tr>
                                        <th className="px-6 py-3 text-left">Time</th>
                                        <th className="px-6 py-3 text-left">URL</th>
                                        <th className="px-6 py-3 text-left">Title</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {studentActivity.length > 0 ? (
                                        studentActivity.map((log) => (
                                            <tr key={log.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${log.is_incognito ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                                                <td className="px-4 sm:px-6 py-4 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                                    {new Date(log.visit_timestamp).toLocaleTimeString()}
                                                </td>
                                                <td className="px-4 sm:px-6 py-4 text-sm text-slate-800 dark:text-slate-200 font-mono" title={log.url}>
                                                    <a href={log.url} target="_blank" rel="noopener noreferrer" className="text-rose-600 hover:text-rose-700 hover:underline dark:text-rose-400 dark:hover:text-rose-300 break-all block max-w-[200px] sm:max-w-md md:max-w-xl lg:max-w-2xl">
                                                        {log.url}
                                                    </a>
                                                </td>
                                                <td className="px-4 sm:px-6 py-4 text-sm text-slate-600 dark:text-slate-400 truncate max-w-[150px] sm:max-w-xs md:max-w-md">
                                                    {log.page_title}
                                                </td>

                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
                                                No activity recorded yet
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
    );
};

export default BrowserMonitoringDashboard;
