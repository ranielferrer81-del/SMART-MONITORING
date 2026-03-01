import React from 'react';
import { getSubjectEnrolledStudents, markStudentAttendance, getStudentAttendanceHistory } from '../../../api/client';

const StudentProfileModal = ({
    showStudentProfile,
    selectedStudent,
    selectedSubject,
    getProfilePictureUrl,
    attendanceBreakdown,
    attendanceChartGradient,
    updatingAttendance,
    setUpdatingAttendance,
    setEnrolledStudents,
    setSelectedStudent,
    setShowStudentProfile,
    setAttendanceHistory,
    setShowHistoryModal,
}) => {
    if (!showStudentProfile || !selectedStudent) return null;

    return (
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
    );
};

export default StudentProfileModal;
