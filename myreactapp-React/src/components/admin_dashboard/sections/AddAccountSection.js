import React from 'react';

const AddAccountSection = ({
    form, setForm, formErrors, setFormErrors,
    creating, submitCreateAccount,
}) => {
    const inputBase = 'mt-1 w-full rounded-lg border px-3 py-2.5 text-sm shadow-sm transition-all duration-300 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20 dark:bg-slate-900/50 dark:text-slate-100 dark:focus:ring-rose-900/40';
    return (
        <div className="space-y-6">
            <div className="overflow-hidden rounded-3xl border border-rose-200/60 bg-gradient-to-br from-white/85 via-rose-50/55 to-indigo-50/45 shadow-[0_22px_55px_-18px_rgba(244,63,94,0.28)] backdrop-blur-xl dark:border-rose-800/40 dark:from-slate-900/85 dark:via-slate-900/75 dark:to-indigo-950/45 dark:shadow-[0_22px_55px_-18px_rgba(0,0,0,0.6)]">
                <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 via-fuchsia-500 to-violet-600" aria-hidden />
                <div className="p-5 lg:p-8">
                <div className="mb-5 rounded-xl border border-rose-200/60 bg-white/70 p-4 backdrop-blur-sm dark:border-rose-900/50 dark:bg-slate-900/50">
                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Account Information</h4>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Create user credentials and assign academic details in one clean flow.</p>
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">Account Type</label>
                        <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className={`${inputBase} border-slate-300/90 bg-white/85 dark:border-slate-600`}>
                            <option value="student">Student</option><option value="teacher">Professor</option><option value="admin">Admin</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">Full Name</label>
                        <input type="text" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} className={`${inputBase} ${formErrors.full_name ? 'border-red-400 bg-red-50' : 'border-slate-300/90 bg-white/85 dark:border-slate-600'}`} placeholder="Enter full name" />
                        {formErrors.full_name && <p className="mt-1 text-xs text-red-600">{formErrors.full_name}</p>}
                    </div>
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">Email</label>
                        <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={`${inputBase} ${formErrors.email ? 'border-red-400 bg-red-50' : 'border-slate-300/90 bg-white/85 dark:border-slate-600'}`} placeholder="Enter email address" />
                        {formErrors.email && <p className="mt-1 text-xs text-red-600">{formErrors.email}</p>}
                    </div>
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">Password</label>
                        <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className={`${inputBase} ${formErrors.password ? 'border-red-400 bg-red-50' : 'border-slate-300/90 bg-white/85 dark:border-slate-600'}`} placeholder="Enter password" />
                        {formErrors.password && <p className="mt-1 text-xs text-red-600">{formErrors.password}</p>}
                    </div>
                    {form.role === 'student' && (
                        <>
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">Course</label>
                                <select value={form.course} onChange={(e) => setForm((f) => ({ ...f, course: e.target.value }))} className={`${inputBase} ${formErrors.course ? 'border-red-400 bg-red-50' : 'border-slate-300/90 bg-white/85 dark:border-slate-600'}`}>
                                    <option value="">Select course</option><option value="BSIT">BSIT</option><option value="BSCS">BSCS</option><option value="BSEMC">BSEMC</option>
                                </select>
                                {formErrors.course && <p className="mt-1 text-xs text-red-600">{formErrors.course}</p>}
                            </div>
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">Section</label>
                                <input type="text" value={form.section} onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))} className={`${inputBase} ${formErrors.section ? 'border-red-400 bg-red-50' : 'border-slate-300/90 bg-white/85 dark:border-slate-600'}`} placeholder="BSIT 3-Y1-2" />
                                {formErrors.section && <p className="mt-1 text-xs text-red-600">{formErrors.section}</p>}
                            </div>
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">Student Number</label>
                                <input type="text" value={form.student_number} onChange={(e) => setForm((f) => ({ ...f, student_number: e.target.value }))} className={`${inputBase} ${formErrors.student_number ? 'border-red-400 bg-red-50' : 'border-slate-300/90 bg-white/85 dark:border-slate-600'}`} placeholder="11 digits" />
                                {formErrors.student_number && <p className="mt-1 text-xs text-red-600">{formErrors.student_number}</p>}
                            </div>
                        </>
                    )}
                </div>
                <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-6 dark:border-slate-700/80">
                    <p className="text-xs text-slate-600 dark:text-slate-300">Tip: use complete real names to keep attendance and reports clean.</p>
                    <button type="button" onClick={() => { setForm({ role: 'student', full_name: '', email: '', password: '', course: '', section: '', student_number: '' }); setFormErrors({}); }} className="rounded-xl border border-slate-300/80 bg-white/80 px-6 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-800">Clear</button>
                    <button type="button" onClick={submitCreateAccount} disabled={creating} className={`rounded-xl px-7 py-2.5 text-sm font-bold text-white shadow-lg transition ${creating ? 'cursor-not-allowed bg-emerald-400/80' : 'bg-gradient-to-r from-emerald-500 to-teal-600 shadow-emerald-500/25 hover:scale-[1.02] hover:from-emerald-400 hover:to-teal-500'}`}>{creating ? 'Creating…' : 'Create account'}</button>
                </div>
                </div>
            </div>
        </div>
    );
};

export default AddAccountSection;
