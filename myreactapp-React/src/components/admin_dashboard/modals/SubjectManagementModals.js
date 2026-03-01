import React from 'react';
import { enrollAllStudentsToSubject } from '../../../api/client';

// ── Enrolled Students Modal ──
export const EnrolledStudentsModal = ({
    showStudentsModal, setShowStudentsModal,
    subjects, enrolledStudents, unenrollStudent,
    loadAvailableStudentsForSubject,
}) => {
    if (!showStudentsModal) return null;
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
};


// ── Add Students Modal ──
export const AddStudentsModal = ({
    showAddStudentsModal, setShowAddStudentsModal,
    showStudentsModal, subjects,
    availableStudents, addStudentsTab, setAddStudentsTab,
    addStudentsSearchTerm, setAddStudentsSearchTerm,
    enrollStudent, loadAvailableStudentsForSubject,
    groupStudentsBySection, getProfilePictureUrl,
    setToast,
}) => {
    if (!showAddStudentsModal || !showStudentsModal) return null;
    const selectedSubject = subjects.find(s => s.id === showStudentsModal);
    if (!selectedSubject) return null;

    return (
        <div
            className="fixed inset-0 bg-slate-900/30 dark:bg-slate-950/40 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4 transition-opacity duration-300"
            onClick={() => {
                setShowAddStudentsModal(false);
                setAddStudentsSearchTerm('');
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
                                setAddStudentsSearchTerm('');
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
                                        setAddStudentsSearchTerm('');
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
                        const courseMap = { bsit: 'BSIT', bscs: 'BSCS', bsemc: 'BSEMC' };
                        const selectedCourse = courseMap[addStudentsTab] || 'BSIT';
                        let courseStudents = availableStudents.filter(student =>
                            (student.course || '').toUpperCase() === selectedCourse
                        );

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
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Photo</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Name</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Email</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Student #</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Status</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Actions</th>
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
                                                                            <svg className="h-6 w-6 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
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
};
