import React from 'react';

const AddStudentsModal = ({
    showAddStudentsModal,
    selectedSubject,
    availableStudents,
    addStudentsTab,
    addStudentsSearchTerm,
    setShowAddStudentsModal,
    setAddStudentsTab,
    setAddStudentsSearchTerm,
    groupStudentsBySection,
    getProfilePictureUrl,
    enrollStudent,
}) => {
    if (!showAddStudentsModal || !selectedSubject) return null;

    return (
        <div
            className="fixed inset-0 bg-slate-900/30 dark:bg-slate-950/40 overflow-y-auto h-full w-full z-[100] flex items-start justify-center p-4 transition-opacity duration-300 pt-32"
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

                {/* Modal Body */}
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
                                                                            <img className="h-10 w-10 rounded-full object-cover border-2 border-rose-200 dark:border-rose-700" src={profilePicUrl} alt={student.full_name || 'Student'} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                                                                        ) : null}
                                                                        <div className={`h-10 w-10 rounded-full bg-gradient-to-br from-rose-100 to-red-100 dark:from-rose-900/30 dark:to-red-900/30 border-2 border-rose-200 dark:border-rose-700 flex items-center justify-center ${profilePicUrl ? 'hidden' : 'flex'}`}>
                                                                            <svg className="h-6 w-6 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-slate-800 dark:text-slate-100">{student.full_name || '-'}</td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-300">{student.email || '-'}</td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-slate-800 dark:text-slate-100">{student.student_number || '-'}</td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${student.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-200'}`}>
                                                                        {student.is_active ? 'Active' : 'Inactive'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                                                    <button onClick={() => enrollStudent(student)} className="text-rose-600 hover:text-rose-900 dark:text-rose-400 dark:hover:text-rose-300">Enroll</button>
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

export default AddStudentsModal;
