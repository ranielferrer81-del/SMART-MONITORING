import React, { useState, useRef } from 'react';
import { aiParseRegistrarFile, batchStoreStudents } from '../../../api/client';

const AddAccountSection = ({
    form, setForm, formErrors, setFormErrors,
    creating, submitCreateAccount,
    onBatchSuccess, setToast,
}) => {
    // Mode switcher: 'single' | 'ai-import'
    const [mode, setMode] = useState('single');

    // AI Registrar Import States
    const [registrarFile, setRegistrarFile] = useState(null);
    const [rawText, setRawText] = useState('');
    const [defaultPassword, setDefaultPassword] = useState('Student@2025');
    const [showPassword, setShowPassword] = useState(false);
    const defaultCourse = 'BSIT';
    const defaultSection = '3-A';
    const emailDomain = 'student.edu';

    // Analysis & Table States
    const [analyzing, setAnalyzing] = useState(false);
    const [aiSource, setAiSource] = useState(null);
    const [parsedStudents, setParsedStudents] = useState([]);
    const [selectedRows, setSelectedRows] = useState(new Set());
    const [filterTab, setFilterTab] = useState('all'); // 'all' | 'valid' | 'conflict'
    const [tableSearch, setTableSearch] = useState('');

    // Execution States
    const [registering, setRegistering] = useState(false);
    const [creationResult, setCreationResult] = useState(null);

    const fileInputRef = useRef(null);

    const inputBase = 'mt-1 w-full rounded-lg border px-3 py-2.5 text-sm shadow-sm transition-all duration-300 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20 dark:bg-slate-900/50 dark:text-slate-100 dark:focus:ring-rose-900/40';

    // Handle File Drop or Select
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setRegistrarFile(file);
            setCreationResult(null);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) {
            setRegistrarFile(file);
            setCreationResult(null);
        }
    };

    // Analyze File with AI
    const handleAnalyze = async () => {
        if (!registrarFile && !rawText.trim()) {
            if (setToast) {
                setToast({ show: true, message: 'Please upload a registrar file or paste roster text first.', type: 'error' });
                setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
            } else {
                alert('Please upload a registrar file or paste roster text first.');
            }
            return;
        }

        try {
            setAnalyzing(true);
            setCreationResult(null);

            const formData = new FormData();
            if (registrarFile) {
                formData.append('file', registrarFile);
            }
            if (rawText.trim()) {
                formData.append('raw_text', rawText.trim());
            }
            formData.append('default_course', defaultCourse);
            formData.append('default_section', defaultSection);
            formData.append('email_domain', emailDomain);

            const res = await aiParseRegistrarFile(formData);

            if (res?.ok && Array.isArray(res.students)) {
                setParsedStudents(res.students);
                setAiSource(res.source || 'ai');

                // Auto-select all valid rows
                const initialSelected = new Set();
                res.students.forEach((s) => {
                    if (s.status === 'valid') {
                        initialSelected.add(s.id);
                    }
                });
                setSelectedRows(initialSelected);

                if (setToast) {
                    setToast({
                        show: true,
                        message: `Parsed ${res.students.length} students (${res.summary?.valid_count || 0} valid)!`,
                        type: 'success',
                    });
                    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
                }
            } else {
                const msg = res?.message || 'Could not parse student records. Please check file formatting.';
                if (setToast) {
                    setToast({ show: true, message: msg, type: 'error' });
                    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
                } else {
                    alert(msg);
                }
            }
        } catch (err) {
            console.error('Analyze error:', err);
            const msg = err.response?.data?.message || err.message || 'Error communicating with AI parser.';
            if (setToast) {
                setToast({ show: true, message: msg, type: 'error' });
                setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
            } else {
                alert(msg);
            }
        } finally {
            setAnalyzing(false);
        }
    };

    // Toggle Select All
    const toggleSelectAll = () => {
        const eligible = filteredStudents.filter((s) => s.status === 'valid');
        if (selectedRows.size >= eligible.length && eligible.length > 0) {
            setSelectedRows(new Set());
        } else {
            const next = new Set(selectedRows);
            eligible.forEach((s) => next.add(s.id));
            setSelectedRows(next);
        }
    };

    // Toggle Single Row Selection
    const toggleRow = (id) => {
        const next = new Set(selectedRows);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedRows(next);
    };

    // Inline edit for student table
    const updateStudentField = (id, field, value) => {
        setParsedStudents((prev) =>
            prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
        );
    };

    // Delete student row from preview
    const removeStudentRow = (id) => {
        setParsedStudents((prev) => prev.filter((s) => s.id !== id));
        setSelectedRows((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    };

    // Filtered students for preview
    const filteredStudents = parsedStudents.filter((s) => {
        if (filterTab === 'valid' && s.status !== 'valid') return false;
        if (filterTab === 'conflict' && s.status !== 'conflict') return false;
        if (tableSearch.trim()) {
            const term = tableSearch.toLowerCase();
            return (
                s.full_name?.toLowerCase().includes(term) ||
                s.email?.toLowerCase().includes(term) ||
                s.student_number?.toLowerCase().includes(term) ||
                s.course?.toLowerCase().includes(term) ||
                s.section?.toLowerCase().includes(term)
            );
        }
        return true;
    });

    // Execute Batch Account Creation
    const handleBatchRegister = async () => {
        const studentsToCreate = parsedStudents
            .filter((s) => selectedRows.has(s.id))
            .map((s) => ({
                full_name: s.full_name,
                email: s.email,
                student_number: s.student_number,
                course: s.course,
                section: s.section,
            }));

        if (studentsToCreate.length === 0) {
            if (setToast) {
                setToast({ show: true, message: 'Please select at least one valid student to register.', type: 'error' });
                setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
            } else {
                alert('Please select at least one valid student to register.');
            }
            return;
        }

        try {
            setRegistering(true);

            const payload = {
                students: studentsToCreate,
                default_password: defaultPassword || 'Student@2025',
            };

            const res = await batchStoreStudents(payload);

            if (res?.ok) {
                setCreationResult(res);

                if (setToast) {
                    setToast({
                        show: true,
                        message: `Successfully created ${res.created_count} accounts!`,
                        type: 'success',
                    });
                    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
                }

                // Refresh main account lists in AdminDashboard
                if (typeof onBatchSuccess === 'function') {
                    onBatchSuccess();
                }

                // Remove successfully created rows from the working list
                const createdEmails = new Set((res.created_students || []).map((s) => s.email.toLowerCase()));
                setParsedStudents((prev) => prev.filter((s) => !createdEmails.has(s.email.toLowerCase())));
                setSelectedRows(new Set());
            } else {
                alert(res?.message || 'Batch creation failed.');
            }
        } catch (err) {
            console.error('Batch register error:', err);
            const msg = err.response?.data?.message || err.message || 'Error creating accounts.';
            alert(msg);
        } finally {
            setRegistering(false);
        }
    };

    // Download CSV of Created Accounts
    const downloadCredentialsCsv = () => {
        if (!creationResult?.created_students?.length) return;

        const headers = ['Full Name', 'Student Number', 'Course', 'Section', 'Email', 'Initial Password'];
        const rows = creationResult.created_students.map((s) => [
            `"${s.full_name || ''}"`,
            `"${s.student_number || ''}"`,
            `"${s.course || ''}"`,
            `"${s.section || ''}"`,
            `"${s.email || ''}"`,
            `"${s.password || defaultPassword || 'Student@2025'}"`,
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `enrolled_students_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6">
            {/* ── Mode Switcher Tab Bar ── */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200/60 bg-white/70 p-2 shadow-sm backdrop-blur-md dark:border-rose-900/40 dark:bg-slate-900/60">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setMode('single')}
                        className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition-all duration-200 ${
                            mode === 'single'
                                ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md shadow-rose-500/20'
                                : 'text-slate-600 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span>Single Account</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setMode('ai-import')}
                        className={`relative flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition-all duration-200 ${
                            mode === 'ai-import'
                                ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md shadow-rose-500/20'
                                : 'text-slate-600 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                    >
                        <svg className="h-4 w-4 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span>AI Registrar Import</span>
                        <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-extrabold uppercase text-amber-600 dark:text-amber-300">
                            Fast & Auto
                        </span>
                    </button>
                </div>

                <div className="hidden pr-2 text-xs text-slate-500 dark:text-slate-400 sm:block">
                    {mode === 'single'
                        ? 'Creating individual credentials'
                        : 'Batch-register whole classes from registrar files'}
                </div>
            </div>

            {/* ── Mode 1: Single Account Manual Form (Preserved Exactly) ── */}
            {mode === 'single' && (
                <div className="overflow-hidden rounded-3xl border border-rose-200/60 bg-gradient-to-br from-white/85 via-rose-50/55 to-red-50/45 shadow-[0_22px_55px_-18px_rgba(244,63,94,0.28)] backdrop-blur-xl dark:border-rose-800/40 dark:from-slate-900/85 dark:via-slate-900/75 dark:to-red-950/45 dark:shadow-[0_22px_55px_-18px_rgba(0,0,0,0.6)]">
                    <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 via-red-500 to-rose-600" aria-hidden />
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
                                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                                            Section <span className="text-[10px] lowercase font-normal text-slate-500">(e.g. 3-Y2-2, 3-A)</span>
                                        </label>
                                        <input type="text" value={form.section} onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))} className={`${inputBase} ${formErrors.section ? 'border-red-400 bg-red-50' : 'border-slate-300/90 bg-white/85 dark:border-slate-600'}`} placeholder="3-Y2-2 (do not include course name)" />
                                        {formErrors.section && <p className="mt-1 text-xs text-red-600">{formErrors.section}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">Student Number</label>
                                        <input type="text" value={form.student_number} onChange={(e) => setForm((f) => ({ ...f, student_number: e.target.value }))} className={`${inputBase} ${formErrors.student_number ? 'border-red-400 bg-red-50' : 'border-slate-300/90 bg-white/85 dark:border-slate-600'}`} placeholder="e.g. 2024-00123 or 20240001001" />
                                        {formErrors.student_number && <p className="mt-1 text-xs text-red-600">{formErrors.student_number}</p>}
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-6 dark:border-slate-700/80">
                            <p className="text-xs text-slate-600 dark:text-slate-300">Tip: use complete real names to keep attendance and reports clean.</p>
                            <button type="button" onClick={() => { setForm({ role: 'student', full_name: '', email: '', password: '', course: '', section: '', student_number: '' }); setFormErrors({}); }} className="rounded-xl border border-slate-300/80 bg-white/80 px-6 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-800">Clear</button>
                            <button type="button" onClick={submitCreateAccount} disabled={creating} className={`rounded-xl px-7 py-2.5 text-sm font-bold text-white shadow-lg transition ${creating ? 'cursor-not-allowed bg-red-400/80' : 'bg-gradient-to-r from-red-500 to-rose-600 shadow-red-500/25 hover:scale-[1.02] hover:from-red-400 hover:to-rose-500'}`}>{creating ? 'Creating…' : 'Create account'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Mode 2: AI Registrar Bulk Import ── */}
            {mode === 'ai-import' && (
                <div className="space-y-6">
                    {/* Header Card */}
                    <div className="overflow-hidden rounded-3xl border border-rose-200/60 bg-gradient-to-br from-white/90 via-rose-50/50 to-red-50/40 p-6 shadow-xl backdrop-blur-xl dark:border-rose-900/50 dark:from-slate-900/90 dark:via-slate-900/70 dark:to-red-950/40">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div>
                                <div className="flex items-center gap-2.5">
                                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-500 to-red-500 text-white shadow-md shadow-rose-500/25">
                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </span>
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                                        Automated Registrar Roster Import
                                    </h3>
                                </div>
                                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                                    Upload the registrar's roster file or paste student list text. The AI extracts names, student IDs, courses, sections, and emails, checks for duplicates, and auto-registers them with your default password.
                                </p>
                            </div>

                            {aiSource && (
                                <div className="flex items-center gap-2 rounded-xl border border-rose-200/80 bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-rose-700 shadow-sm dark:border-rose-900/60 dark:bg-slate-800/80 dark:text-rose-300">
                                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span>Engine: {aiSource}</span>
                                </div>
                            )}
                        </div>

                        {/* File Upload Zone & Text Input */}
                        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
                            {/* Drag and Drop Zone */}
                            <div
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-300 ${
                                    registrarFile
                                        ? 'border-emerald-500/80 bg-emerald-50/40 dark:border-emerald-500/40 dark:bg-emerald-950/20'
                                        : 'border-rose-300/80 bg-white/60 hover:border-rose-500 hover:bg-rose-50/40 dark:border-rose-900/60 dark:bg-slate-900/40 dark:hover:border-rose-500/60'
                                }`}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept=".csv,.txt,.xlsx,.xls,.docx,.doc,.pdf,image/png,image/jpeg"
                                    className="hidden"
                                />

                                {registrarFile ? (
                                    <div className="space-y-2">
                                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
                                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{registrarFile.name}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {(registrarFile.size / 1024).toFixed(1)} KB — Click to change file
                                        </p>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setRegistrarFile(null);
                                            }}
                                            className="text-xs font-semibold text-rose-600 hover:underline dark:text-rose-400"
                                        >
                                            Remove file
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 shadow-sm dark:bg-rose-900/40 dark:text-rose-400">
                                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                            </svg>
                                        </div>
                                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                            Click to upload or drag & drop registrar file
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Supports Excel (.xlsx, .csv), Word (.docx), Notepad (.txt), PDF, or images
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Raw Text Fallback */}
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                                    Or paste roster text / table
                                </label>
                                <textarea
                                    rows={5}
                                    value={rawText}
                                    onChange={(e) => {
                                        setRawText(e.target.value);
                                        setCreationResult(null);
                                    }}
                                    placeholder="Fatima Perez, 20240001001, BSIT, 3-A, fatima@student.edu&#10;Mark Santos, 20240001002, BSIT, 3-A, mark@student.edu..."
                                    className="mt-1.5 w-full rounded-2xl border border-slate-300/80 bg-white/80 p-3 text-xs shadow-inner focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100"
                                />
                            </div>
                        </div>

                        {/* Password Configuration */}
                        <div className="mt-5 border-t border-rose-200/60 pt-5 dark:border-rose-900/50">
                            <div className="max-w-md">
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                    Initial Password for Enrolled Students
                                </label>
                                <div className="relative mt-1">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={defaultPassword}
                                        onChange={(e) => setDefaultPassword(e.target.value)}
                                        placeholder="Student@2025"
                                        className={inputBase}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                    >
                                        {showPassword ? 'Hide' : 'Show'}
                                    </button>
                                </div>
                                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                                    The system reads the <strong>Full Name</strong>, <strong>Student ID</strong>, <strong>Course</strong>, <strong>Section</strong>, and <strong>Email</strong> directly from your file. This password will be assigned to all new accounts so students can log in for the first time.
                                </p>
                            </div>
                        </div>

                        {/* Analyze Trigger */}
                        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-5 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() => {
                                    setRegistrarFile(null);
                                    setRawText('');
                                    setParsedStudents([]);
                                    setCreationResult(null);
                                }}
                                className="rounded-xl border border-slate-300/80 bg-white/80 px-5 py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                                Reset All
                            </button>

                            <button
                                type="button"
                                onClick={handleAnalyze}
                                disabled={analyzing}
                                className={`flex items-center gap-2 rounded-xl px-7 py-2.5 text-sm font-bold text-white shadow-lg transition ${
                                    analyzing
                                        ? 'cursor-not-allowed bg-rose-400'
                                        : 'bg-gradient-to-r from-rose-500 to-red-600 shadow-rose-500/25 hover:scale-[1.02] hover:from-rose-400 hover:to-red-500'
                                }`}
                            >
                                {analyzing ? (
                                    <>
                                        <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        <span>Analyzing Roster with AI…</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        <span>Analyze & Verify Roster</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* ── Success Creation Result Card ── */}
                    {creationResult && (
                        <div className="overflow-hidden rounded-3xl border border-emerald-300 bg-emerald-50/90 p-6 shadow-xl backdrop-blur-xl dark:border-emerald-800 dark:bg-emerald-950/40">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
                                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h4 className="text-base font-bold text-emerald-900 dark:text-emerald-100">
                                            {creationResult.created_count} Accounts Successfully Created!
                                        </h4>
                                        <p className="text-xs text-emerald-700 dark:text-emerald-300">
                                            Default Password: <code className="rounded bg-emerald-200/70 px-1.5 py-0.5 font-bold text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100">{defaultPassword}</code>
                                            {creationResult.skipped_count > 0 && ` • (${creationResult.skipped_count} skipped as duplicates)`}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={downloadCredentialsCsv}
                                    className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/25 transition hover:bg-emerald-700"
                                >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    <span>Download Credentials (CSV)</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Interactive Preview & Verification Table ── */}
                    {parsedStudents.length > 0 && (
                        <div className="space-y-4">
                            {/* Summary Bar */}
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200/60 bg-white/80 p-4 shadow-sm backdrop-blur-md dark:border-rose-900/40 dark:bg-slate-900/60">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                        Found {parsedStudents.length} Students:
                                    </span>

                                    <button
                                        type="button"
                                        onClick={() => setFilterTab('all')}
                                        className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                                            filterTab === 'all'
                                                ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900'
                                                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        All ({parsedStudents.length})
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setFilterTab('valid')}
                                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition ${
                                            filterTab === 'valid'
                                                ? 'bg-emerald-600 text-white'
                                                : 'text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30'
                                        }`}
                                    >
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                        Valid ({parsedStudents.filter((s) => s.status === 'valid').length})
                                    </button>

                                    {parsedStudents.some((s) => s.status === 'conflict') && (
                                        <button
                                            type="button"
                                            onClick={() => setFilterTab('conflict')}
                                            className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition ${
                                                filterTab === 'conflict'
                                                    ? 'bg-amber-600 text-white'
                                                    : 'text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30'
                                            }`}
                                        >
                                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                            Duplicates ({parsedStudents.filter((s) => s.status === 'conflict').length})
                                        </button>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center gap-3">
                                    <input
                                        type="text"
                                        placeholder="Search preview list…"
                                        value={tableSearch}
                                        onChange={(e) => setTableSearch(e.target.value)}
                                        className="rounded-xl border border-slate-300/80 bg-white/80 px-3 py-1.5 text-xs focus:border-rose-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                    />

                                    <button
                                        type="button"
                                        onClick={handleBatchRegister}
                                        disabled={registering || selectedRows.size === 0}
                                        className={`flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-bold text-white shadow-lg transition ${
                                            registering || selectedRows.size === 0
                                                ? 'cursor-not-allowed bg-rose-300'
                                                : 'bg-gradient-to-r from-rose-500 to-red-600 shadow-rose-500/25 hover:scale-[1.02]'
                                        }`}
                                    >
                                        {registering ? (
                                            <>
                                                <svg className="h-3.5 w-3.5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                </svg>
                                                <span>Registering…</span>
                                            </>
                                        ) : (
                                            <>
                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                <span>Register Selected ({selectedRows.size})</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/70 shadow-sm backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-900/60">
                                <table className="min-w-full divide-y divide-slate-200/80 text-left text-xs dark:divide-slate-700/80">
                                    <thead className="bg-slate-50/80 font-bold uppercase tracking-wider text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                                        <tr>
                                            <th className="px-4 py-3">
                                                <input
                                                    type="checkbox"
                                                    checked={
                                                        filteredStudents.filter((s) => s.status === 'valid').length > 0 &&
                                                        filteredStudents.filter((s) => s.status === 'valid').every((s) => selectedRows.has(s.id))
                                                    }
                                                    onChange={toggleSelectAll}
                                                    className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                                                />
                                            </th>
                                            <th className="px-4 py-3">Status</th>
                                            <th className="px-4 py-3">Full Name</th>
                                            <th className="px-4 py-3">Email Address</th>
                                            <th className="px-4 py-3">Student Number</th>
                                            <th className="px-4 py-3">Course</th>
                                            <th className="px-4 py-3">Section</th>
                                            <th className="px-4 py-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white/50 dark:divide-slate-800 dark:bg-slate-900/30">
                                        {filteredStudents.map((s) => {
                                            const isSelected = selectedRows.has(s.id);
                                            const isConflict = s.status === 'conflict';
                                            return (
                                                <tr
                                                    key={s.id}
                                                    className={`transition-colors hover:bg-rose-50/50 dark:hover:bg-slate-800/40 ${
                                                        isConflict ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                                                    }`}
                                                >
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleRow(s.id)}
                                                            disabled={isConflict}
                                                            className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 disabled:opacity-30"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        {isConflict ? (
                                                            <span
                                                                title={s.conflict_reason}
                                                                className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"
                                                            >
                                                                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                                </svg>
                                                                {s.conflict_reason || 'Duplicate'}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                                                                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                </svg>
                                                                Ready
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="text"
                                                            value={s.full_name}
                                                            onChange={(e) => updateStudentField(s.id, 'full_name', e.target.value)}
                                                            className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-xs font-semibold text-slate-800 hover:border-slate-300 focus:border-rose-500 focus:bg-white focus:outline-none dark:text-slate-100 dark:focus:bg-slate-900"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="text"
                                                            value={s.email}
                                                            onChange={(e) => updateStudentField(s.id, 'email', e.target.value)}
                                                            className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-xs text-slate-600 hover:border-slate-300 focus:border-rose-500 focus:bg-white focus:outline-none dark:text-slate-300 dark:focus:bg-slate-900"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="text"
                                                            value={s.student_number}
                                                            onChange={(e) => updateStudentField(s.id, 'student_number', e.target.value)}
                                                            className="w-28 rounded border border-transparent bg-transparent px-1.5 py-1 text-xs font-mono text-slate-800 hover:border-slate-300 focus:border-rose-500 focus:bg-white focus:outline-none dark:text-slate-100 dark:focus:bg-slate-900"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <select
                                                            value={s.course}
                                                            onChange={(e) => updateStudentField(s.id, 'course', e.target.value)}
                                                            className="rounded border border-transparent bg-transparent px-1 py-1 text-xs font-semibold text-rose-600 hover:border-slate-300 focus:border-rose-500 focus:bg-white focus:outline-none dark:text-rose-400 dark:focus:bg-slate-900"
                                                        >
                                                            <option value="BSIT">BSIT</option>
                                                            <option value="BSCS">BSCS</option>
                                                            <option value="BSEMC">BSEMC</option>
                                                        </select>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="text"
                                                            value={s.section}
                                                            onChange={(e) => updateStudentField(s.id, 'section', e.target.value)}
                                                            className="w-24 rounded border border-transparent bg-transparent px-1.5 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 focus:border-rose-500 focus:bg-white focus:outline-none dark:text-slate-200 dark:focus:bg-slate-900"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <button
                                                            type="button"
                                                            onClick={() => removeStudentRow(s.id)}
                                                            className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-800"
                                                            title="Remove row"
                                                        >
                                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AddAccountSection;
