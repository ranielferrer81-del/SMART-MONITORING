import React from 'react';
import { fetchMe, updateStudentProfile, updateStudentPin } from '../../../api/client';

const SettingsSection = ({
    user, setUser,
    settingsForm, setSettingsForm, settingsErrors, setSettingsErrors,
    settingsSaving, setSettingsSaving, settingsSuccess, setSettingsSuccess,
    pin, setPin, pinSaving, setPinSaving, pinError, setPinError, pinSuccess, setPinSuccess,
}) => {
    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        setSettingsErrors({});
        setSettingsSuccess('');
        const errors = {};
        if (!settingsForm.full_name || !settingsForm.full_name.trim()) errors.full_name = 'Full name is required';
        if (settingsForm.password) {
            if (settingsForm.password.length < 6) errors.password = 'Password must be at least 6 characters';
            if (!settingsForm.current_password) errors.current_password = 'Current password is required to change password';
        }
        if (Object.keys(errors).length > 0) { setSettingsErrors(errors); return; }
        setSettingsSaving(true);
        try {
            const payload = { full_name: settingsForm.full_name.trim() };
            if (settingsForm.password) { payload.password = settingsForm.password; payload.current_password = settingsForm.current_password; }
            const res = await updateStudentProfile(payload);
            if (res?.ok) {
                setSettingsSuccess('Profile updated successfully!');
                const userRes = await fetchMe();
                if (userRes?.ok) { setUser(userRes.data); try { localStorage.setItem('user', JSON.stringify(userRes.data)); } catch (_) { } }
                setSettingsForm(prev => ({ ...prev, password: '', current_password: '' }));
                setTimeout(() => setSettingsSuccess(''), 3000);
            } else { setSettingsErrors({ submit: res?.error || 'Failed to update profile' }); }
        } catch (error) { setSettingsErrors({ submit: error.message || 'Failed to update profile' }); }
        finally { setSettingsSaving(false); }
    };

    const handlePinSubmit = async (e) => {
        e.preventDefault();
        setPinError(''); setPinSuccess('');
        if (!/^\d{4}$/.test(pin)) { setPinError('PIN must be exactly 4 digits.'); return; }
        setPinSaving(true);
        const res = await updateStudentPin(pin);
        setPinSaving(false);
        if (!res.ok) { setPinError(res.error || 'Failed to update PIN.'); }
        else { setPinSuccess('PIN updated successfully.'); setPin(''); setTimeout(() => setPinSuccess(''), 3000); }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-rose-500/20 to-red-500/20 backdrop-blur-sm rounded-2xl border border-rose-200/50 dark:border-rose-800/50 p-6 lg:p-8">
                <div className="flex items-center space-x-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-rose-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </div>
                    <div>
                        <h3 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-rose-600 to-red-600 bg-clip-text text-transparent dark:from-rose-400 dark:to-red-400">Settings</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Manage your account preferences and security settings</p>
                    </div>
                </div>
            </div>

            {/* Profile Information Card */}
            <div className="bg-white/40 backdrop-blur-md shadow-2xl rounded-2xl border border-white/20 dark:bg-slate-900/40 dark:border-white/10 overflow-hidden">
                <div className="bg-gradient-to-r from-rose-50/50 to-red-50/50 dark:from-rose-900/20 dark:to-red-900/20 border-b border-rose-200/50 dark:border-rose-800/50 px-6 lg:px-8 py-4">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-red-600 rounded-lg flex items-center justify-center"><svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></div>
                        <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Profile Information</h4>
                    </div>
                </div>
                <div className="p-6 lg:p-8">
                    <form onSubmit={handleProfileSubmit} className="space-y-6">
                        <div>
                            <label className="flex items-center text-sm font-semibold text-slate-900 dark:text-slate-50 mb-2">
                                <svg className="w-4 h-4 mr-2 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                Full Name <span className="text-red-500 ml-1">*</span>
                            </label>
                            <input type="text" value={settingsForm.full_name} onChange={(e) => setSettingsForm(prev => ({ ...prev, full_name: e.target.value }))} className={`w-full px-4 py-3 rounded-xl border-2 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all ${settingsErrors.full_name ? 'border-red-300 bg-red-50/50 dark:bg-red-900/20' : 'border-slate-300 dark:border-slate-700'}`} placeholder="Enter your full name" />
                            {settingsErrors.full_name && <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center"><svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{settingsErrors.full_name}</p>}
                        </div>
                        <div className="flex justify-end pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
                            <button type="submit" disabled={settingsSaving} className="px-6 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white text-sm font-semibold shadow-lg shadow-rose-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2">
                                {settingsSaving ? (<><svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Saving...</span></>) : (<><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg><span>Save Profile</span></>)}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Password Security Card */}
            <div className="bg-white/10 backdrop-blur-sm shadow-2xl rounded-2xl border border-slate-200/50 dark:bg-slate-900/10 dark:border-slate-800/50 overflow-hidden">
                <div className="bg-gradient-to-r from-rose-50/50 to-red-50/50 dark:from-rose-900/20 dark:to-red-900/20 border-b border-rose-200/50 dark:border-rose-800/50 px-6 lg:px-8 py-4">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-red-600 rounded-lg flex items-center justify-center"><svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg></div>
                        <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Password Security</h4>
                    </div>
                </div>
                <div className="p-6 lg:p-8">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 flex items-start"><svg className="w-5 h-5 mr-2 text-rose-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Leave password fields empty if you don't want to change your password.</p>
                    <div className="space-y-4">
                        <div>
                            <label className="flex items-center text-sm font-semibold text-slate-900 dark:text-slate-50 mb-2"><svg className="w-4 h-4 mr-2 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>Current Password {settingsForm.password && <span className="text-red-500 ml-1">*</span>}</label>
                            <input type="password" value={settingsForm.current_password} onChange={(e) => setSettingsForm(prev => ({ ...prev, current_password: e.target.value }))} className={`w-full px-4 py-3 rounded-xl border-2 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all ${settingsErrors.current_password ? 'border-red-300 bg-red-50/50 dark:bg-red-900/20' : 'border-slate-300 dark:border-slate-700'}`} placeholder="Enter current password" />
                            {settingsErrors.current_password && <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center"><svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{settingsErrors.current_password}</p>}
                        </div>
                        <div>
                            <label className="flex items-center text-sm font-semibold text-slate-900 dark:text-slate-50 mb-2"><svg className="w-4 h-4 mr-2 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>New Password</label>
                            <input type="password" value={settingsForm.password} onChange={(e) => setSettingsForm(prev => ({ ...prev, password: e.target.value }))} className={`w-full px-4 py-3 rounded-xl border-2 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all ${settingsErrors.password ? 'border-red-300 bg-red-50/50 dark:bg-red-900/20' : 'border-slate-300 dark:border-slate-700'}`} placeholder="Enter new password (min 6 characters)" />
                            {settingsErrors.password && <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center"><svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{settingsErrors.password}</p>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Security PIN Card */}
            <div className="bg-white/10 backdrop-blur-sm shadow-2xl rounded-2xl border border-slate-200/50 dark:bg-slate-900/10 dark:border-slate-800/50 overflow-hidden">
                <div className="bg-gradient-to-r from-rose-50/50 to-red-50/50 dark:from-rose-900/20 dark:to-red-900/20 border-b border-rose-200/50 dark:border-rose-800/50 px-6 lg:px-8 py-4">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-red-600 rounded-lg flex items-center justify-center"><svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3zm0 2c-2.21 0-4 1.343-4 3v1h8v-1c0-1.657-1.79-3-4-3z" /></svg></div>
                        <div><h4 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Security PIN</h4><p className="text-xs text-slate-700 dark:text-slate-200 font-medium">For desktop SMART Card system</p></div>
                    </div>
                </div>
                <div className="p-6 lg:p-8">
                    <form onSubmit={handlePinSubmit} className="space-y-4">
                        <div>
                            <label className="flex items-center text-sm font-semibold text-slate-900 dark:text-slate-50 mb-3"><svg className="w-4 h-4 mr-2 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3zm0 2c-2.21 0-4 1.343-4 3v1h8v-1c0-1.657-1.79-3-4-3z" /></svg>4-Digit PIN</label>
                            <div className="flex items-center space-x-4">
                                <input type="password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} maxLength={4} className="w-40 text-center text-3xl tracking-[0.5em] bg-gradient-to-br from-rose-50 to-red-50 dark:from-slate-800 dark:to-slate-900 border-2 border-rose-300 dark:border-rose-700 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 placeholder:text-slate-400 font-mono" placeholder="••••" />
                                <button type="submit" disabled={pinSaving} className="px-6 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white text-sm font-semibold shadow-lg shadow-rose-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2">
                                    {pinSaving ? (<><svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Saving...</span></>) : (<><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg><span>Save PIN</span></>)}
                                </button>
                            </div>
                            <p className="mt-2 text-xs text-slate-700 dark:text-slate-200 font-medium flex items-center"><svg className="w-4 h-4 mr-1 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Keep this PIN secret. It's used for desktop SMART Card authentication.</p>
                        </div>
                        {pinError && (<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start"><svg className="w-5 h-5 text-red-600 dark:text-red-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><p className="text-sm text-red-600 dark:text-red-400">{pinError}</p></div>)}
                        {pinSuccess && (<div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-start"><svg className="w-5 h-5 text-green-600 dark:text-green-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><p className="text-sm text-green-600 dark:text-green-400">{pinSuccess}</p></div>)}
                    </form>
                </div>
            </div>

            {/* Error/Success Messages */}
            {settingsErrors.submit && (<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start"><svg className="w-5 h-5 text-red-600 dark:text-red-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><p className="text-sm text-red-600 dark:text-red-400">{settingsErrors.submit}</p></div>)}
            {settingsSuccess && (<div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-start"><svg className="w-5 h-5 text-green-600 dark:text-green-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><p className="text-sm text-green-600 dark:text-green-400">{settingsSuccess}</p></div>)}
        </div>
    );
};

export default SettingsSection;
