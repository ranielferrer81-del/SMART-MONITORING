import React from 'react';

const SubjectsSection = ({
    enrolledSubjects,
    loadingSubjects,
    attendanceData,
    loadingAttendance,
    fetchAttendance,
    openSessions,
    loadingOpenSessions,
    checkInPin,
    setCheckInPin,
    checkInMessage,
    checkInError,
    checkingInSubjectId,
    handleCheckIn,
}) => {
    return (
        <div className="max-w-full lg:max-w-6xl mx-auto">
            <div className="bg-white/40 backdrop-blur-md shadow-2xl rounded-2xl border border-white/20 dark:bg-slate-900/40 dark:border-white/10 overflow-hidden">
                <div className="p-3 sm:p-4 lg:p-8">
                    <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                            <h3 className="text-2xl font-semibold text-slate-900 dark:text-white mb-1">Enrolled Subjects</h3>
                            <p className="text-sm text-slate-700 dark:text-slate-200 font-medium">View your enrolled subjects and track your attendance</p>
                        </div>
                        <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-rose-50 to-red-50 dark:from-rose-900/30 dark:to-red-900/30 border border-rose-200/60 dark:border-rose-800/60 px-4 py-2 rounded-xl shadow-sm">
                            <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                            <span className="text-sm font-semibold text-rose-700 dark:text-rose-100">{enrolledSubjects.length} Subject{enrolledSubjects.length !== 1 ? 's' : ''}</span>
                        </div>
                    </div>

                    <div className="mb-6 rounded-xl border border-rose-200/60 bg-rose-50/60 p-4 dark:border-rose-900/60 dark:bg-rose-900/20">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <h4 className="text-sm font-semibold text-rose-700 dark:text-rose-200">Open Sessions Now (PIN Check-in)</h4>
                            {loadingOpenSessions && <span className="text-xs text-rose-600 dark:text-rose-300">Loading...</span>}
                        </div>
                        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                            <input
                                type="password"
                                inputMode="numeric"
                                maxLength={4}
                                value={checkInPin}
                                onChange={(e) => setCheckInPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                className="w-full sm:w-56 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm dark:border-rose-700 dark:bg-slate-900"
                                placeholder="Enter 4-digit PIN"
                            />
                            <span className="text-xs text-slate-700 dark:text-slate-300">Attendance is only recorded if session day/time is valid.</span>
                        </div>
                        {checkInMessage && <p className="mb-2 text-sm text-green-700 dark:text-green-300">{checkInMessage}</p>}
                        {checkInError && <p className="mb-2 text-sm text-red-700 dark:text-red-300">{checkInError}</p>}
                        {openSessions?.length ? (
                            <div className="space-y-2">
                                {openSessions.map((session) => (
                                    <div key={`${session.id}-${session.start_time}`} className="flex flex-col gap-2 rounded-lg border border-rose-100 bg-white/80 p-3 dark:border-rose-800 dark:bg-slate-900/60 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{session.name} ({session.code})</p>
                                            <p className="text-xs text-slate-600 dark:text-slate-300">{session.start_time} - {session.end_time} | {session.window_status === 'open' ? `Expected: ${session.expected_status}` : 'Window closed'}</p>
                                        </div>
                                        <button
                                            onClick={() => handleCheckIn(session.id)}
                                            disabled={session.window_status !== 'open' || checkingInSubjectId === session.id}
                                            className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {checkingInSubjectId === session.id ? 'Checking in...' : 'Check In'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-slate-600 dark:text-slate-300">No open session right now.</p>
                        )}
                    </div>

                    {loadingSubjects ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="flex flex-col items-center space-y-3">
                                <svg className="w-10 h-10 animate-spin text-rose-600" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                <p className="text-slate-700 dark:text-slate-200 font-medium text-sm">Loading subjects...</p>
                            </div>
                        </div>
                    ) : enrolledSubjects.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="w-20 h-20 bg-slate-100/10 backdrop-blur-sm dark:bg-slate-800/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
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
                                    <div key={subjectId} className="bg-slate-50/10 backdrop-blur-sm dark:bg-slate-800/10 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-6 hover:shadow-lg transition-shadow">
                                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-12 h-12 bg-gradient-to-br from-rose-500 to-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                                    </div>
                                                    <div className="flex-1">
                                                        <h4 className="text-lg font-semibold text-slate-900 dark:text-white">{subject.name || subject.subject_name || 'Unnamed Subject'}</h4>
                                                        <div className="flex flex-wrap gap-3 mt-2 text-sm text-slate-600 dark:text-slate-400">
                                                            <span className="flex items-center gap-1">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                                                                Code: <span className="font-medium">{subject.code || subject.subject_code || 'N/A'}</span>
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                                                Section: <span className="font-medium">{subject.section || 'N/A'}</span>
                                                            </span>
                                                            {subject.teacher_name && (
                                                                <span className="flex items-center gap-1">
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                                    Professor: <span className="font-medium">{subject.teacher_name}</span>
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <button onClick={() => fetchAttendance(subjectId)} disabled={isLoadingAtt} className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium shadow hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                                                {isLoadingAtt ? (
                                                    <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Loading...</>
                                                ) : attendance ? 'Refresh Attendance' : 'View Attendance'}
                                            </button>
                                        </div>

                                        {attendance && (
                                            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                                                <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-50 font-semibold mb-4">Attendance Summary</h5>
                                                {attendance.error ? (
                                                    <p className="text-sm text-red-600 dark:text-red-400">Failed to load attendance data.</p>
                                                ) : (
                                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                                                        <div className="bg-green-50/40 backdrop-blur-sm dark:bg-green-900/20 border border-green-200/50 dark:border-green-800/50 rounded-lg p-4">
                                                            <p className="text-xs uppercase tracking-widest text-green-600 dark:text-green-400 mb-1">Present</p>
                                                            <p className="text-2xl font-bold text-green-700 dark:text-green-300">{attendance.present || 0}</p>
                                                        </div>
                                                        <div className="bg-red-50/40 backdrop-blur-sm dark:bg-red-900/20 border border-red-200/50 dark:border-red-800/50 rounded-lg p-4">
                                                            <p className="text-xs uppercase tracking-widest text-red-600 dark:text-red-400 mb-1">Absent</p>
                                                            <p className="text-2xl font-bold text-red-700 dark:text-red-300">{attendance.absent || 0}</p>
                                                        </div>
                                                        <div className="bg-amber-50/40 backdrop-blur-sm dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-800/50 rounded-lg p-4">
                                                            <p className="text-xs uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-1">Late</p>
                                                            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{attendance.late || 0}</p>
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
                                                                <div key={idx} className={`flex items-center justify-between p-2 rounded-lg text-sm ${record.status === 'present' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : record.status === 'late' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
                                                                    <span className="font-medium">{record.date || record.attendance_date || 'N/A'}</span>
                                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${record.status === 'present' ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200' : record.status === 'late' ? 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200' : 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200'}`}>{record.status === 'present' ? 'Present' : record.status === 'late' ? 'Late' : 'Absent'}</span>
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
    );
};

export default SubjectsSection;
