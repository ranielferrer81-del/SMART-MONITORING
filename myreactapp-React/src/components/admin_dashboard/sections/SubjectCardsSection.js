import React from 'react';

const SubjectCardsSection = ({
    subjects, enrolledStudents, refreshSubjects,
    setShowStudentsModal, setActiveSection,
}) => {
    return (
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
                                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Professor:</span>
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
    );
};

export default SubjectCardsSection;
