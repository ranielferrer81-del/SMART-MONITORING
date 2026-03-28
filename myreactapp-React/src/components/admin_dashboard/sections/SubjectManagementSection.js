import React from 'react';
import { createSubject, deleteSubject } from '../../../api/client';

const SubjectManagementSection = ({
    subjects, refreshSubjects, newSubject, setNewSubject,
    subErrors, setSubErrors, teachers, getAvailableSections,
    setToast,
}) => {
    const handleCreateSubject = async () => {
        const errs = {};
        if (!newSubject.code.trim()) errs.code = 'Required';
        if (!newSubject.name.trim()) errs.name = 'Required';
        if (!newSubject.course) errs.course = 'Required';
        if (!newSubject.section.trim()) errs.section = 'Required';
        if (!newSubject.teacher_user_id) errs.teacher_user_id = 'Required';
        setSubErrors(errs);
        if (Object.keys(errs).length) return;
        try {
            const payload = {
                code: newSubject.code,
                name: newSubject.name,
                course: newSubject.course,
                section: newSubject.section,
                teacher_user_id: newSubject.teacher_user_id ? parseInt(newSubject.teacher_user_id) : null
            };
            const res = await createSubject(payload);
            if (res?.ok) {
                await refreshSubjects();
                setNewSubject({ code: '', name: '', course: '', section: '', teacher_user_id: '' });
                setSubErrors({});
                setToast({ show: true, message: 'Subject created successfully!', type: 'success' });
                setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 2500);
            } else {
                setToast({ show: true, message: res?.message || 'Failed to create subject', type: 'error' });
                setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
            }
        } catch (e) {
            console.log('Create subject error', e);
            const errorMsg = e?.response?.data?.message || 'Network error';
            setToast({ show: true, message: errorMsg, type: 'error' });
            setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
        }
    };

    const handleDeleteSubject = async (subId) => {
        try {
            const res = await deleteSubject(subId);
            if (res?.ok) {
                await refreshSubjects();
            }
        } catch (e) { console.log('Delete subject error', e); }
    };

    return (
        <div className="space-y-6">
            <div className="overflow-hidden rounded-3xl border border-white/40 bg-gradient-to-br from-white/70 to-slate-50/50 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/10 dark:from-slate-900/80 dark:to-slate-950/90 dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.55)]">
                <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-rose-500 to-amber-400" aria-hidden />
            <div className="p-4 lg:p-6">
                <div className="mb-4 flex justify-end">
                    <button
                        onClick={refreshSubjects}
                        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-rose-500/20 transition hover:from-rose-500 hover:to-red-500 hover:shadow-lg"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Refresh</span>
                    </button>
                </div>

                {/* Create Subject Form */}
                <div className="mb-6 rounded-2xl border border-slate-200/70 bg-white/60 p-4 shadow-inner transition-all duration-300 hover:shadow-lg dark:border-slate-700/60 dark:bg-slate-900/50">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Subject Code</label>
                            <input
                                type="text"
                                value={newSubject.code}
                                onChange={(e) => setNewSubject((s) => ({ ...s, code: e.target.value }))}
                                className={`mt-1 block w-full border rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500 transition-all duration-300 ${subErrors.code ? 'border-red-300 bg-red-50' : 'border-slate-300 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100'}`}
                                placeholder="example:311, 112, 211,"
                            />
                            {subErrors.code && <p className="mt-1 text-[10px] text-red-600">{subErrors.code}</p>}
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Subject Name</label>
                            <input
                                type="text"
                                value={newSubject.name}
                                onChange={(e) => setNewSubject((s) => ({ ...s, name: e.target.value }))}
                                className={`mt-1 block w-full border rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500 transition-all duration-300 ${subErrors.name ? 'border-red-300 bg-red-50' : 'border-slate-300 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100'}`}
                                placeholder="WEBDEV, IPTC, DBSA"
                            />
                            {subErrors.name && <p className="mt-1 text-[10px] text-red-600">{subErrors.name}</p>}
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Course</label>
                            <select
                                value={newSubject.course}
                                onChange={(e) => {
                                    const course = e.target.value;
                                    const options = getAvailableSections(course);
                                    setNewSubject((s) => ({ ...s, course, section: options.includes(s.section) ? s.section : '' }));
                                }}
                                className={`mt-1 block w-full border rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500 transition-all duration-300 ${subErrors.course ? 'border-red-300 bg-red-50' : 'border-slate-300 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100'}`}
                            >
                                <option value="">Select</option>
                                <option value="BSIT">BSIT</option>
                                <option value="BSCS">BSCS</option>
                                <option value="BSEMC">BSEMC</option>
                            </select>
                            {subErrors.course && <p className="mt-1 text-[10px] text-red-600">{subErrors.course}</p>}
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Section</label>
                            <select
                                value={newSubject.section}
                                onChange={(e) => setNewSubject((s) => ({ ...s, section: e.target.value }))}
                                disabled={!newSubject.course}
                                className={`mt-1 block w-full border rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500 transition-all duration-300 ${subErrors.section ? 'border-red-300 bg-red-50' : 'border-slate-300 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100'}`}
                            >
                                <option value="">{newSubject.course ? 'Select section' : 'Select course first'}</option>
                                {getAvailableSections(newSubject.course).map((sec) => (
                                    <option key={sec} value={sec}>{sec}</option>
                                ))}
                            </select>
                            {subErrors.section && <p className="mt-1 text-[10px] text-red-600">{subErrors.section}</p>}
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Professor</label>
                            <select
                                value={newSubject.teacher_user_id}
                                onChange={(e) => setNewSubject((s) => ({ ...s, teacher_user_id: e.target.value }))}
                                className={`mt-1 block w-full border rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500 transition-all duration-300 ${subErrors.teacher_user_id ? 'border-red-300 bg-red-50' : 'border-slate-300 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100'}`}
                            >
                                <option value="">Select Professor</option>
                                {teachers.map((teacher) => (
                                    <option key={teacher.id} value={teacher.id}>
                                        {teacher.full_name} {teacher.teacher_number ? `(${teacher.teacher_number})` : ''}
                                    </option>
                                ))}
                            </select>
                            {subErrors.teacher_user_id && <p className="mt-1 text-[10px] text-red-600">{subErrors.teacher_user_id}</p>}
                        </div>
                    </div>
                    <div className="flex justify-end mt-3">
                        <button
                            onClick={handleCreateSubject}
                            className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-rose-600 via-red-600 to-red-600 hover:from-rose-700 hover:via-red-700 hover:to-red-700 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-rose-500/40"
                        >
                            Add Subject
                        </button>
                    </div>
                </div>

                {/* Subjects Table */}
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-xs dark:divide-slate-700">
                        <thead className="bg-slate-100/40 backdrop-blur-sm dark:bg-slate-800/40">
                            <tr>
                                <th className="px-3 py-2 text-left font-medium text-slate-700 uppercase tracking-wider dark:text-slate-300">Code</th>
                                <th className="px-3 py-2 text-left font-medium text-slate-700 uppercase tracking-wider dark:text-slate-300">Subject</th>
                                <th className="px-3 py-2 text-left font-medium text-slate-700 uppercase tracking-wider dark:text-slate-300">Course</th>
                                <th className="px-3 py-2 text-left font-medium text-slate-700 uppercase tracking-wider dark:text-slate-300">Section</th>
                                <th className="px-3 py-2 text-left font-medium text-slate-700 uppercase tracking-wider dark:text-slate-300">Professor</th>
                                <th className="px-3 py-2 text-left font-medium text-slate-700 uppercase tracking-wider dark:text-slate-300">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white/30 backdrop-blur-sm divide-y divide-slate-200/50 dark:bg-slate-900/30 dark:divide-slate-700/50">
                            {subjects.map((sub) => (
                                <tr key={sub.id} className="hover:bg-slate-50/40 backdrop-blur-sm transition-colors duration-200 dark:hover:bg-slate-800/40">
                                    <td className="px-3 py-1 whitespace-nowrap text-slate-800 dark:text-slate-100">{sub.code}</td>
                                    <td className="px-3 py-1 whitespace-nowrap text-slate-800 dark:text-slate-100">{sub.name}</td>
                                    <td className="px-3 py-1 whitespace-nowrap text-slate-800 dark:text-slate-100">{sub.course}</td>
                                    <td className="px-3 py-1 whitespace-nowrap text-slate-800 dark:text-slate-100">{sub.section}</td>
                                    <td className="px-3 py-1 whitespace-nowrap text-slate-800 dark:text-slate-100">
                                        {sub.teacher_name || <span className="text-slate-400 italic">Not assigned</span>}
                                    </td>
                                    <td className="px-3 py-1 whitespace-nowrap">
                                        <button
                                            onClick={() => handleDeleteSubject(sub.id)}
                                            className="text-red-600 hover:text-red-800 transition-colors duration-300 transform hover:scale-110 dark:text-red-400 dark:hover:text-red-300"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {subjects.length === 0 && (
                                <tr>
                                    <td className="px-3 py-2 text-slate-500" colSpan="6">No subjects yet. Create one above.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            </div>
        </div>
    );
};

export default SubjectManagementSection;
