import React from 'react';

const AddAccountSection = ({
    form, setForm, formErrors, setFormErrors,
    creating, submitCreateAccount,
}) => {
    return (
        <div className="space-y-6">
            <div className="bg-white/40 backdrop-blur-xl shadow-2xl rounded-2xl border border-slate-200/60 p-4 lg:p-6 dark:bg-slate-900/40 dark:border-slate-800/60">
                <div className="mb-6">
                    <h3 className="text-xl font-semibold text-slate-800 mb-2 dark:text-slate-100">Create New Account</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Fill in the details below to create a new user account</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">Account Type</label>
                        <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500 py-2 px-3 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100">
                            <option value="student">Student</option><option value="teacher">Teacher</option><option value="admin">Admin</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">Full Name</label>
                        <input type="text" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} className={`w-full border rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500 py-2 px-3 ${formErrors.full_name ? 'border-red-300 bg-red-50' : 'border-gray-300 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100'}`} placeholder="Enter full name" />
                        {formErrors.full_name && <p className="mt-1 text-xs text-red-600">{formErrors.full_name}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">Email</label>
                        <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={`w-full border rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500 py-2 px-3 ${formErrors.email ? 'border-red-300 bg-red-50' : 'border-gray-300 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100'}`} placeholder="Enter email address" />
                        {formErrors.email && <p className="mt-1 text-xs text-red-600">{formErrors.email}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">Password</label>
                        <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className={`w-full border rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500 py-2 px-3 ${formErrors.password ? 'border-red-300 bg-red-50' : 'border-gray-300 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100'}`} placeholder="Enter password" />
                        {formErrors.password && <p className="mt-1 text-xs text-red-600">{formErrors.password}</p>}
                    </div>
                    {form.role === 'student' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">Course</label>
                                <select value={form.course} onChange={(e) => setForm((f) => ({ ...f, course: e.target.value }))} className={`w-full border rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500 py-2 px-3 ${formErrors.course ? 'border-red-300 bg-red-50' : 'border-gray-300 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100'}`}>
                                    <option value="">Select course</option><option value="BSIT">BSIT</option><option value="BSCS">BSCS</option><option value="BSEMC">BSEMC</option>
                                </select>
                                {formErrors.course && <p className="mt-1 text-xs text-red-600">{formErrors.course}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">Section</label>
                                <input type="text" value={form.section} onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))} className={`w-full border rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500 py-2 px-3 ${formErrors.section ? 'border-red-300 bg-red-50' : 'border-gray-300 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100'}`} placeholder="BSIT 3-Y1-2" />
                                {formErrors.section && <p className="mt-1 text-xs text-red-600">{formErrors.section}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">Student Number</label>
                                <input type="text" value={form.student_number} onChange={(e) => setForm((f) => ({ ...f, student_number: e.target.value }))} className={`w-full border rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-2 px-3 ${formErrors.student_number ? 'border-red-300 bg-red-50' : 'border-gray-300 dark:bg-slate-900/30 dark:border-slate-700/50 dark:text-slate-100'}`} placeholder="Student Number" />
                                {formErrors.student_number && <p className="mt-1 text-xs text-red-600">{formErrors.student_number}</p>}
                            </div>
                        </>
                    )}
                </div>
                <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-slate-800">
                    <button onClick={() => { setForm({ role: 'student', full_name: '', email: '', password: '', course: '', section: '', student_number: '' }); setFormErrors({}); }} className="px-6 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">Clear Form</button>
                    <button onClick={submitCreateAccount} disabled={creating} className={`px-6 py-2 text-sm font-medium text-white rounded-lg transition-colors ${creating ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}>{creating ? 'Creating...' : 'Create Account'}</button>
                </div>
            </div>
        </div>
    );
};

export default AddAccountSection;
