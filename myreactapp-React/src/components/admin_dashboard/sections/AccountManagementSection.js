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
                        <div className="overflow-x-auto rounded-2xl ring-1 ring-slate-200/60 dark:ring-slate-700/60">
                            <table className="min-w-full divide-y divide-slate-200/80 dark:divide-slate-700/80">
                                <thead>
                                    <tr className="bg-gradient-to-r from-indigo-500/10 via-sky-500/5 to-cyan-500/10 dark:from-indigo-950/50 dark:via-slate-900/80 dark:to-cyan-950/30">
                                        <th className="px-3 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-indigo-900/90 dark:text-indigo-200/90 lg:px-6">Photo</th>
                                        <th className="px-3 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-indigo-900/90 dark:text-indigo-200/90 lg:px-6">Name</th>
                                        <th className="px-3 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-indigo-900/90 dark:text-indigo-200/90 lg:px-6">Email</th>
                                        <th className="px-3 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-indigo-900/90 dark:text-indigo-200/90 lg:px-6">Student #</th>
                                        <th className="px-3 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-indigo-900/90 dark:text-indigo-200/90 lg:px-6">Status</th>
                                        <th className="px-3 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-indigo-900/90 dark:text-indigo-200/90 lg:px-6">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white/50 dark:divide-slate-800/80 dark:bg-slate-950/20">
                                    {sectionStudents.map((s) => {
                                        const profilePicUrl = getProfilePictureUrl(s.profile_picture);
                                        return (
                                            <tr key={s.id} className="transition-colors hover:bg-gradient-to-r hover:from-indigo-50/80 hover:to-transparent dark:hover:from-indigo-950/20 dark:hover:to-transparent">
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
                                                <td className="px-3 lg:px-6 py-3 lg:py-4 whitespace-nowrap">
                                                    <div className="flex flex-wrap gap-2">
                                                    <button type="button" onClick={() => openEdit(s)} className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/50">Edit</button>
                                                    <button type="button" onClick={() => handleDeleteAccount(s.id)} className="rounded-lg border border-red-200/80 bg-red-50/80 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">Delete</button>
                                                    </div>
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
        <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-gradient-to-br from-white/70 via-white/40 to-rose-50/30 p-[1px] shadow-[0_20px_60px_-15px_rgba(244,63,94,0.2)] backdrop-blur-xl dark:border-white/10 dark:from-slate-900/90 dark:via-slate-900/70 dark:to-rose-950/20 dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]">
            <div className="rounded-[1.4rem] border border-white/40 bg-white/40 p-4 dark:border-white/5 dark:bg-slate-950/40 sm:p-6">
            <div className="space-y-6">
            {/* Search Bar */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white/60 p-1 shadow-inner dark:border-slate-600/50 dark:bg-slate-900/50">
                <div className="relative rounded-xl bg-white/80 dark:bg-slate-900/30">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                        <svg className="h-5 w-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <input type="text" placeholder="Search by name, email, student #, section, department…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="block w-full rounded-xl border-0 bg-transparent py-3.5 pl-12 pr-10 text-sm text-slate-800 placeholder-slate-400 ring-1 ring-transparent transition focus:outline-none focus:ring-2 focus:ring-rose-500/50 dark:text-slate-100 dark:placeholder-slate-500" />
                    {searchTerm && (<button type="button" onClick={() => setSearchTerm('')} className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-rose-600"><svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>)}
                </div>
                {searchTerm && (<div className="mt-2 px-1 text-sm text-slate-600 dark:text-slate-400">Filtering: <span className="font-semibold text-rose-600 dark:text-rose-300">"{searchTerm}"</span></div>)}
            </div>

            {/* Tabs — segmented control */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-100/80 p-1.5 dark:border-slate-700/80 dark:bg-slate-900/60">
                <nav className="flex flex-wrap gap-1">
                    {[{ id: 'teachers', label: 'Professors' }, { id: 'bsit', label: 'Students — BSIT' }, { id: 'bscs', label: 'Students — BSCS' }, { id: 'bsemc', label: 'Students — BSEMC' }].map((t) => (
                        <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`min-w-0 flex-1 rounded-xl px-3 py-2.5 text-center text-xs font-semibold transition-all sm:flex-none sm:px-4 sm:text-sm ${tab === t.id ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md shadow-rose-500/30' : 'text-slate-600 hover:bg-white/90 dark:text-slate-300 dark:hover:bg-white/5'}`}>{t.label}</button>
                    ))}
                </nav>
            </div>

            {/* Tables per tab */}
            <div className="overflow-x-auto rounded-2xl ring-1 ring-slate-200/60 dark:ring-slate-700/60">
                {tab === 'teachers' && (
                    <table className="min-w-full divide-y divide-slate-200/80 dark:divide-slate-700/80">
                        <thead>
                            <tr className="bg-gradient-to-r from-rose-500/10 via-red-500/5 to-violet-500/10 dark:from-rose-900/40 dark:via-slate-900/80 dark:to-violet-900/30">
                                <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-rose-800/90 dark:text-rose-200/90 lg:px-6">Photo</th>
                                <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-rose-800/90 dark:text-rose-200/90 lg:px-6">Name</th>
                                <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-rose-800/90 dark:text-rose-200/90 lg:px-6">Email</th>
                                <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-rose-800/90 dark:text-rose-200/90 lg:px-6">Department</th>
                                <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-rose-800/90 dark:text-rose-200/90 lg:px-6">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white/50 dark:divide-slate-800/80 dark:bg-slate-950/20">
                            {filterAccounts(teachers, searchTerm).map((t) => {
                                const profilePicUrl = getProfilePictureUrl(t.profile_picture);
                                return (
                                    <tr key={t.id} className="transition-colors hover:bg-gradient-to-r hover:from-rose-50/90 hover:to-transparent dark:hover:from-rose-950/25 dark:hover:to-transparent">
                                        <td className="whitespace-nowrap px-4 py-4 lg:px-6">
                                            <div className="h-10 w-10 shrink-0">
                                                {profilePicUrl ? (<img className="h-10 w-10 rounded-full border-2 border-rose-200 object-cover shadow-md dark:border-rose-600/50" src={profilePicUrl} alt={t.full_name} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />) : null}
                                                <div className={`h-10 w-10 rounded-full border-2 border-rose-200 bg-gradient-to-br from-rose-100 to-red-100 dark:border-rose-700 dark:from-rose-900/40 dark:to-red-900/30 flex items-center justify-center ${profilePicUrl ? 'hidden' : 'flex'}`}>
                                                    <svg className="h-6 w-6 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-slate-900 dark:text-slate-100 lg:px-6">{t.full_name}</td>
                                        <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600 dark:text-slate-400 lg:px-6">{t.email}</td>
                                        <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700 dark:text-slate-300 lg:px-6">{t.department || '—'}</td>
                                        <td className="whitespace-nowrap px-4 py-4 lg:px-6">
                                            <div className="flex flex-wrap gap-2">
                                            <button type="button" onClick={() => openEdit(t)} className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300 dark:hover:bg-rose-900/60">Edit</button>
                                            <button type="button" onClick={() => handleDeleteAccount(t.id)} className="rounded-lg border border-red-200/80 bg-red-50/80 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50">Delete</button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filterAccounts(teachers, searchTerm).length === 0 && (
                                <tr><td colSpan="5" className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">{searchTerm ? `No professors match "${searchTerm}".` : 'No professors yet.'}</td></tr>
                            )}
                        </tbody>
                    </table>
                )}

                {tab === 'bsit' && renderStudentTable('BSIT', studentsBSIT)}
                {tab === 'bscs' && renderStudentTable('BSCS', studentsBSCS)}
                {tab === 'bsemc' && renderStudentTable('BSEMC', studentsBSEMC)}
            </div>
            </div>
            </div>
        </div>
    );
};

export default AccountManagementSection;
