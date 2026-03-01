import React from 'react';

const AttendanceHistoryModal = ({
    showHistoryModal,
    selectedSubject,
    selectedStudent,
    loadingHistory,
    attendanceHistory,
    setShowHistoryModal,
    setEditingRecord,
    setShowEditModal,
}) => {
    if (!showHistoryModal || !selectedSubject || !selectedStudent) return null;

    return (
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
    );
};

export default AttendanceHistoryModal;
