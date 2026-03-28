import React from 'react';

const AccountManagementSection = ({
    tab, setTab, searchTerm, setSearchTerm,
    teachers, studentsBSIT, studentsBSCS, studentsBSEMC,
    filterAccounts, groupStudentsBySection, mergeCustomSectionsIntoGroups,
    getProfilePictureUrl, openEdit, handleDeleteAccount,
    newSection, setNewSection, handleAddSection,
}) => {
    const renderStudentTable = (course, students) => {
        return (
            <div className="space-y-6">
                <div className="flex items-end space-x-3">
                    <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700 dark:text-slate-300">Add Section for {course}</label>
                        <input type="text" value={newSection.section} onChange={(e) => setNewSection((s) => ({ ...s, section: e.target.value }))} placeholder="Add Section" className="mt-1 block w-full max-w-sm border-gray-300 rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100" />
                    </div>
                    <button onClick={() => handleAddSection(course)} className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300">Add Section</button>
                </div>
                {Object.entries(mergeCustomSectionsIntoGroups(groupStudentsBySection(filterAccounts(students, searchTerm)), course)).map(([section, sectionStudents]) => (
                    <div key={section} className="mb-6">
                        <div className="px-3 lg:px-6 py-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-slate-100">{course} - {section} ({sectionStudents.length} student{sectionStudents.length !== 1 ? 's' : ''})</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50/40 backdrop-blur-sm dark:bg-slate-800/40">
                                    <tr>
                                        <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Photo</th>
                                        <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Name</th>
                                        <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Email</th>
                                        <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Student #</th>
                                        <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Status</th>
                                        <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white/30 backdrop-blur-sm divide-y divide-gray-200/50 dark:bg-slate-900/30 dark:divide-slate-700/50">
                                    {sectionStudents.map((s) => {
                                        const profilePicUrl = getProfilePictureUrl(s.profile_picture);
                                        return (
                                            <tr key={s.id}>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex-shrink-0 h-10 w-10">
                                                        {profilePicUrl ? (<img className="h-10 w-10 rounded-full object-cover border-2 border-rose-200 dark:border-rose-700" src={profilePicUrl} alt={s.full_name} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />) : null}
                                                        <div className={`h-10 w-10 rounded-full bg-gradient-to-br from-rose-100 to-red-100 dark:from-rose-900/30 dark:to-red-900/30 border-2 border-rose-200 dark:border-rose-700 flex items-center justify-center ${profilePicUrl ? 'hidden' : 'flex'}`}>
                                                            <svg className="h-6 w-6 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-xs lg:text-sm text-slate-800 dark:text-slate-100">{s.full_name}</td>
                                                <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-xs lg:text-sm text-gray-500 dark:text-slate-300">{s.email}</td>
                                                <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-xs lg:text-sm">{s.student_number}</td>
                                                <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${s.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-200'}`}>{s.is_active ? 'Active' : 'Inactive'}</span>
                                                </td>
                                                <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-xs lg:text-sm font-medium space-x-1 lg:space-x-2">
                                                    <button onClick={() => openEdit(s)} className="text-rose-600 hover:text-red-700 dark:text-rose-400 dark:hover:text-rose-300">Edit</button>
                                                    <button onClick={() => handleDeleteAccount(s.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">Delete</button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
                {Object.keys(groupStudentsBySection(filterAccounts(students, searchTerm))).length === 0 && (
                    <div className="text-center py-8 text-gray-500">{searchTerm ? `No ${course} students found matching "${searchTerm}"` : `No ${course} students found`}</div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold bg-gradient-to-r from-rose-600 to-red-600 bg-clip-text text-transparent">Account Management</h3>
            </div>

            {/* Search Bar */}
            <div className="mb-6 bg-white/40 backdrop-blur-xl border border-slate-200/60 rounded-2xl p-4 shadow-lg dark:bg-slate-900/40 dark:border-slate-800/60">
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <input type="text" placeholder="Search accounts by name, email, student number, section, or department..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="block w-full pl-10 pr-3 py-3 border border-gray-300/50 rounded-lg leading-5 bg-white/30 backdrop-blur-sm placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-sm dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100 dark:placeholder-slate-400" />
                    {searchTerm && (<button onClick={() => setSearchTerm('')} className="absolute inset-y-0 right-0 pr-3 flex items-center"><svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>)}
                </div>
                {searchTerm && (<div className="mt-3 text-sm text-slate-600 dark:text-slate-300">Searching for: <span className="font-medium text-rose-600 dark:text-rose-400">"{searchTerm}"</span></div>)}
            </div>

            {/* Tabs */}
            <div className="mb-6 bg-white/40 backdrop-blur-xl border border-slate-200/60 rounded-2xl px-4 py-3 shadow-lg dark:bg-slate-900/40 dark:border-slate-800/60">
                <nav className="flex flex-wrap gap-3">
                    {[{ id: 'teachers', label: 'Professors' }, { id: 'bsit', label: 'Students - BSIT' }, { id: 'bscs', label: 'Students - BSCS' }, { id: 'bsemc', label: 'Students - BSEMC' }].map((t) => (
                        <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ${tab === t.id ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/40' : 'text-slate-600 hover:text-rose-600 hover:bg-rose-50/80 dark:text-slate-300 dark:hover:bg-rose-900/30'}`}>{t.label}</button>
                    ))}
                </nav>
            </div>

            {/* Tables per tab */}
            <div className="overflow-x-auto">
                {tab === 'teachers' && (
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                        <thead className="bg-gray-50/40 backdrop-blur-sm dark:bg-slate-800/40">
                            <tr>
                                <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Photo</th>
                                <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Name</th>
                                <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Email</th>
                                <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Department</th>
                                <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Status</th>
                                <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-slate-300">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white/30 backdrop-blur-sm divide-y divide-gray-200/50 dark:bg-slate-900/30 dark:divide-slate-700/50">
                            {filterAccounts(teachers, searchTerm).map((t) => {
                                const profilePicUrl = getProfilePictureUrl(t.profile_picture);
                                return (
                                    <tr key={t.id}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex-shrink-0 h-10 w-10">
                                                {profilePicUrl ? (<img className="h-10 w-10 rounded-full object-cover border-2 border-rose-200 dark:border-rose-700" src={profilePicUrl} alt={t.full_name} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />) : null}
                                                <div className={`h-10 w-10 rounded-full bg-gradient-to-br from-rose-100 to-red-100 dark:from-rose-900/30 dark:to-red-900/30 border-2 border-rose-200 dark:border-rose-700 flex items-center justify-center ${profilePicUrl ? 'hidden' : 'flex'}`}>
                                                    <svg className="h-6 w-6 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-xs lg:text-sm text-slate-800 dark:text-slate-100">{t.full_name}</td>
                                        <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-xs lg:text-sm text-gray-500 dark:text-slate-300">{t.email}</td>
                                        <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-xs lg:text-sm">{t.department || '-'}</td>
                                        <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${t.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-200'}`}>{t.is_active ? 'Active' : 'Inactive'}</span>
                                        </td>
                                        <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-xs lg:text-sm font-medium space-x-1 lg:space-x-2">
                                            <button onClick={() => openEdit(t)} className="text-rose-600 hover:text-red-700 dark:text-rose-400 dark:hover:text-rose-300">Edit</button>
                                            <button onClick={() => handleDeleteAccount(t.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">Delete</button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filterAccounts(teachers, searchTerm).length === 0 && (
                                <tr><td colSpan="6" className="px-6 py-8 text-center text-gray-500">{searchTerm ? `No professors found matching "${searchTerm}"` : 'No professors found'}</td></tr>
                            )}
                        </tbody>
                    </table>
                )}

                {tab === 'bsit' && renderStudentTable('BSIT', studentsBSIT)}
                {tab === 'bscs' && renderStudentTable('BSCS', studentsBSCS)}
                {tab === 'bsemc' && renderStudentTable('BSEMC', studentsBSEMC)}
            </div>
        </div>
    );
};

export default AccountManagementSection;
