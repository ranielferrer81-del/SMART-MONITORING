import React from 'react';
import { getSubjectEnrolledStudents, getStudentAttendanceHistory, updateAttendanceRecord } from '../../../api/client';

const EditAttendanceModal = ({
    showEditModal,
    editingRecord,
    selectedSubject,
    selectedStudent,
    updatingRecord,
    setUpdatingRecord,
    setShowEditModal,
    setEditingRecord,
    setAttendanceHistory,
    setEnrolledStudents,
    setSelectedStudent,
}) => {
    if (!showEditModal || !editingRecord || !selectedSubject || !selectedStudent) return null;

    const handleUpdateStatus = async (newStatus) => {
        if (!selectedSubject || !selectedStudent || !editingRecord) return;
        setUpdatingRecord(true);
        try {
            const res = await updateAttendanceRecord(
                selectedSubject.id,
                selectedStudent.id,
                editingRecord.id,
                newStatus
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
    };

    return (
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
                                onClick={() => handleUpdateStatus('present')}
                                disabled={updatingRecord || editingRecord.status === 'present'}
                                className={`px-4 py-3 rounded-lg font-semibold text-sm transition-all ${editingRecord.status === 'present'
                                    ? 'bg-green-200 text-green-800 cursor-not-allowed opacity-60 dark:bg-green-900/60 dark:text-green-300'
                                    : 'bg-green-600 hover:bg-green-700 text-white shadow hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed'
                                    }`}
                            >
                                Present
                            </button>
                            <button
                                onClick={() => handleUpdateStatus('late')}
                                disabled={updatingRecord || editingRecord.status === 'late'}
                                className={`px-4 py-3 rounded-lg font-semibold text-sm transition-all ${editingRecord.status === 'late'
                                    ? 'bg-amber-200 text-amber-800 cursor-not-allowed opacity-60 dark:bg-amber-900/60 dark:text-amber-300'
                                    : 'bg-amber-500 hover:bg-amber-600 text-white shadow hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed'
                                    }`}
                            >
                                Late
                            </button>
                            <button
                                onClick={() => handleUpdateStatus('absent')}
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
    );
};

export default EditAttendanceModal;
