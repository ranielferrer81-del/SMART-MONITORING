import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { getSubjectEnrolledStudents } from '../../api/client';
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
            {showStudentsModal && selectedSubject && createPortal(
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
                                                            src={student.profile_picture.startsWith('data:') ? student.profile_picture : `${process.env.REACT_APP_API_BASE || 'http://127.0.0.1:8000'}${student.profile_picture.startsWith('/') ? '' : '/'}${student.profile_picture}`}
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
                </div>,
                document.body
            )}
        </>
    );
};

export default BrowserMonitoringSection;
