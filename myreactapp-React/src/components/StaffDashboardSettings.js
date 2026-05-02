import React, { useEffect, useState } from 'react';
import { fetchMe, updateTeacherProfile, updateAdminProfile } from '../api/client';
import {
  getMonitoringPollSeconds,
  setMonitoringPollSeconds,
  getNotifyIncognitoDesktop,
  setNotifyIncognitoDesktop,
  getAdminDefaultAccountsTab,
  setAdminDefaultAccountsTab,
  getAdminConfirmBeforeDelete,
  setAdminConfirmBeforeDelete,
} from '../utils/dashboardPrefs';

function normalizeStoredUser(d) {
  if (!d || typeof d !== 'object') return d;
  return {
    ...d,
    fullName: d.full_name ?? d.fullName ?? null,
  };
}

/**
 * Settings for professor and admin dashboards: account, monitoring, and workspace preferences.
 */
const ADMIN_TAB_IDS = ['teachers', 'bsit', 'bscs', 'bsemc'];

export default function StaffDashboardSettings({
  role,
  user,
  setUser,
  onMonitoringPollSaved,
  /** Current Account Management tab — keeps settings dropdown in sync */
  adminAccountsTab,
  setAdminAccountsTab,
}) {
  const [form, setForm] = useState({
    full_name: '',
    department: '',
    specialization: '',
    position: '',
    current_password: '',
    password: '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [pollSec, setPollSec] = useState(() => getMonitoringPollSeconds());
  const [notifyIncognito, setNotifyIncognito] = useState(() => getNotifyIncognitoDesktop());
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const [defaultAdminTab, setDefaultAdminTab] = useState(() => getAdminDefaultAccountsTab());
  const [confirmDelete, setConfirmDelete] = useState(() => getAdminConfirmBeforeDelete());

  useEffect(() => {
    if (!user) return;
    setForm((prev) => ({
      ...prev,
      full_name: user.full_name || user.fullName || '',
      department: user.department ?? '',
      specialization: user.specialization ?? '',
      position: user.position ?? '',
    }));
  }, [user]);

  const refreshUserFromApi = async () => {
    const res = await fetchMe();
    if (res?.ok && res?.data) {
      const merged = normalizeStoredUser(res.data);
      setUser(merged);
      try {
        localStorage.setItem('user', JSON.stringify(merged));
      } catch (_) {}
      setForm((prev) => ({
        ...prev,
        full_name: merged.full_name || merged.fullName || '',
        department: merged.department ?? '',
        specialization: merged.specialization ?? '',
        position: merged.position ?? '',
      }));
    }
  };

  useEffect(() => {
    void refreshUserFromApi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (role === 'admin' && adminAccountsTab && ADMIN_TAB_IDS.includes(adminAccountsTab)) {
      setDefaultAdminTab(adminAccountsTab);
    }
  }, [role, adminAccountsTab]);

  const handleAccountSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setSuccess('');
    const nextErrors = {};
    if (!form.full_name.trim()) nextErrors.full_name = 'Full name is required';
    if (form.password) {
      if (form.password.length < 6) nextErrors.password = 'Password must be at least 6 characters';
      if (!form.current_password) nextErrors.current_password = 'Current password is required to change password';
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      const payload = { full_name: form.full_name.trim() };
      if (form.password) {
        payload.password = form.password;
        payload.current_password = form.current_password;
      }
      if (role === 'teacher') {
        payload.department = form.department.trim() || null;
        payload.specialization = form.specialization.trim() || null;
      }
      if (role === 'admin') {
        payload.position = form.position.trim() || null;
      }

      const res =
        role === 'teacher' ? await updateTeacherProfile(payload) : await updateAdminProfile(payload);

      if (res?.ok) {
        setSuccess('Saved successfully.');
        setForm((prev) => ({ ...prev, password: '', current_password: '' }));
        await refreshUserFromApi();
        setTimeout(() => setSuccess(''), 4000);
      } else {
        setErrors({ submit: res?.error || 'Save failed' });
      }
    } catch (err) {
      setErrors({ submit: err?.message || 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const handlePollSave = (e) => {
    e.preventDefault();
    const n = setMonitoringPollSeconds(pollSec);
    setPollSec(n);
    if (typeof onMonitoringPollSaved === 'function') {
      onMonitoringPollSaved(n);
    }
    setSuccess(`Monitoring refresh interval set to ${n} seconds.`);
    setTimeout(() => setSuccess(''), 4000);
  };

  const handleNotifySave = (e) => {
    e.preventDefault();
    setNotifyIncognitoDesktop(notifyIncognito);
    setSuccess(
      notifyIncognito
        ? 'Desktop notifications enabled for new incognito alerts (after permission is granted).'
        : 'Desktop notifications for incognito alerts are off.'
    );
    setTimeout(() => setSuccess(''), 4000);
  };

  const requestNotificationPermission = async () => {
    if (typeof Notification === 'undefined') {
      setSuccess('This browser does not support notifications.');
      setTimeout(() => setSuccess(''), 4000);
      return;
    }
    try {
      const p = await Notification.requestPermission();
      setNotifPermission(p);
      if (p === 'granted') {
        setNotifyIncognito(true);
        setNotifyIncognitoDesktop(true);
        setSuccess('Notifications allowed. New incognito alerts will show a desktop message.');
      } else {
        setSuccess('Notifications were blocked. Allow them in your browser settings to use this feature.');
      }
      setTimeout(() => setSuccess(''), 5000);
    } catch (_) {
      setSuccess('Could not request notification permission.');
      setTimeout(() => setSuccess(''), 4000);
    }
  };

  const handleAdminWorkspaceSave = (e) => {
    e.preventDefault();
    const t = setAdminDefaultAccountsTab(defaultAdminTab);
    setDefaultAdminTab(t);
    if (typeof setAdminAccountsTab === 'function') {
      setAdminAccountsTab(t);
    }
    setAdminConfirmBeforeDelete(confirmDelete);
    setSuccess('Admin workspace preferences saved.');
    setTimeout(() => setSuccess(''), 4000);
  };

  const title = role === 'teacher' ? 'Professor settings' : 'Administrator settings';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-gradient-to-r from-rose-500/20 to-red-500/20 backdrop-blur-sm rounded-2xl border border-rose-200/50 dark:border-rose-800/50 p-6 lg:p-8">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 bg-gradient-to-br from-rose-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-rose-600 to-red-600 bg-clip-text text-transparent dark:from-rose-400 dark:to-red-400">
              {title}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Account, security, and SMART monitoring preferences for this browser
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleAccountSubmit} className="bg-white/40 backdrop-blur-md shadow-2xl rounded-2xl border border-white/20 dark:bg-slate-900/40 dark:border-white/10 overflow-hidden">
        <div className="bg-gradient-to-r from-rose-50/50 to-red-50/50 dark:from-rose-900/20 dark:to-red-900/20 border-b border-rose-200/50 dark:border-rose-800/50 px-6 lg:px-8 py-4">
          <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Account</h4>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Name and profile fields stored on the server</p>
        </div>
        <div className="p-6 lg:p-8 space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-900 dark:text-slate-50 mb-2 block">Full name</label>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
              className={`w-full px-4 py-3 rounded-xl border-2 bg-white/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500 ${
                errors.full_name ? 'border-red-300' : 'border-slate-300 dark:border-slate-700'
              }`}
            />
            {errors.full_name && <p className="mt-1 text-sm text-red-600">{errors.full_name}</p>}
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-900 dark:text-slate-50 mb-2 block">Email</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 mt-1">Contact an administrator to change your email.</p>
          </div>

          {role === 'teacher' && (
            <>
              <div>
                <label className="text-sm font-semibold text-slate-900 dark:text-slate-50 mb-2 block">Department</label>
                <input
                  type="text"
                  value={form.department}
                  onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-900 dark:text-slate-50 mb-2 block">Specialization</label>
                <input
                  type="text"
                  value={form.specialization}
                  onChange={(e) => setForm((p) => ({ ...p, specialization: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </>
          )}

          {role === 'admin' && (
            <div>
              <label className="text-sm font-semibold text-slate-900 dark:text-slate-50 mb-2 block">Position / title</label>
              <input
                type="text"
                value={form.position}
                onChange={(e) => setForm((p) => ({ ...p, position: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                placeholder="e.g. System Administrator"
              />
            </div>
          )}

          <div className="pt-4 border-t border-slate-200/60 dark:border-slate-700/60 space-y-4">
            <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Change password</h5>
            <p className="text-xs text-slate-600 dark:text-slate-400">Leave blank to keep your current password.</p>
            <div>
              <label className="text-sm font-semibold text-slate-900 dark:text-slate-50 mb-2 block">Current password</label>
              <input
                type="password"
                value={form.current_password}
                onChange={(e) => setForm((p) => ({ ...p, current_password: e.target.value }))}
                className={`w-full px-4 py-3 rounded-xl border-2 bg-white/50 dark:bg-slate-800/50 ${
                  errors.current_password ? 'border-red-300' : 'border-slate-300 dark:border-slate-700'
                }`}
                autoComplete="current-password"
              />
              {errors.current_password && <p className="mt-1 text-sm text-red-600">{errors.current_password}</p>}
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-900 dark:text-slate-50 mb-2 block">New password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                className={`w-full px-4 py-3 rounded-xl border-2 bg-white/50 dark:bg-slate-800/50 ${
                  errors.password ? 'border-red-300' : 'border-slate-300 dark:border-slate-700'
                }`}
                autoComplete="new-password"
              />
              {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
            </div>
          </div>

          {errors.submit && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">
              {errors.submit}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white text-sm font-semibold shadow-lg disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save account'}
            </button>
          </div>
        </div>
      </form>

      {role === 'teacher' && (
        <>
          <form onSubmit={handlePollSave} className="bg-white/40 backdrop-blur-md shadow-2xl rounded-2xl border border-white/20 dark:bg-slate-900/40 dark:border-white/10 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-50/50 to-teal-50/50 dark:from-emerald-900/20 dark:to-teal-900/20 border-b border-emerald-200/50 dark:border-emerald-800/50 px-6 lg:px-8 py-4">
              <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Live monitoring refresh</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                How often online students, incognito alerts, and activity data refresh on this device
              </p>
            </div>
            <div className="p-6 lg:p-8 space-y-4">
              <label className="block text-sm font-semibold text-slate-900 dark:text-slate-50">
                Refresh every{' '}
                <input
                  type="number"
                  min={5}
                  max={120}
                  step={5}
                  value={pollSec}
                  onChange={(e) => setPollSec(parseInt(e.target.value, 10) || 15)}
                  className="w-20 mx-1 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-center font-mono"
                />{' '}
                seconds (5–120)
              </label>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold shadow"
              >
                Save interval
              </button>
            </div>
          </form>

          <form onSubmit={handleNotifySave} className="bg-white/40 backdrop-blur-md shadow-2xl rounded-2xl border border-white/20 dark:bg-slate-900/40 dark:border-white/10 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-50/50 to-orange-50/50 dark:from-amber-900/20 dark:to-orange-900/20 border-b border-amber-200/50 dark:border-amber-800/50 px-6 lg:px-8 py-4">
              <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Incognito alerts</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Get a desktop notification when a new incognito alert is reported (same timing as your refresh interval)
              </p>
            </div>
            <div className="p-6 lg:p-8 space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyIncognito}
                  onChange={(e) => setNotifyIncognito(e.target.checked)}
                  className="mt-1 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <span className="text-sm text-slate-800 dark:text-slate-200">
                  Show desktop notifications for new incognito alerts
                </span>
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Browser status: <strong className="text-slate-700 dark:text-slate-300">{notifPermission}</strong>
                {notifPermission !== 'granted' && (
                  <>
                    {' '}
                    — use the button below so your browser can show alerts while this tab is in the background.
                  </>
                )}
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={requestNotificationPermission}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold"
                >
                  Allow notifications in browser
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl border-2 border-slate-300 dark:border-slate-600 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Save alert preference
                </button>
              </div>
            </div>
          </form>
        </>
      )}

      {role === 'admin' && (
        <form onSubmit={handleAdminWorkspaceSave} className="bg-white/40 backdrop-blur-md shadow-2xl rounded-2xl border border-white/20 dark:bg-slate-900/40 dark:border-white/10 overflow-hidden">
          <div className="bg-gradient-to-r from-sky-50/50 to-indigo-50/50 dark:from-sky-900/20 dark:to-indigo-900/20 border-b border-sky-200/50 dark:border-sky-800/50 px-6 lg:px-8 py-4">
            <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Account management workspace</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Defaults when you open Account Management and safer deletes (stored in this browser)
            </p>
          </div>
          <div className="p-6 lg:p-8 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-900 dark:text-slate-50 mb-2">
                Default tab when opening Account Management
              </label>
              <select
                value={defaultAdminTab}
                onChange={(e) => setDefaultAdminTab(e.target.value)}
                className="w-full max-w-md px-4 py-3 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              >
                <option value="teachers">Professors</option>
                <option value="bsit">BSIT students</option>
                <option value="bscs">BSCS students</option>
                <option value="bsemc">BSEMC students</option>
              </select>
              <p className="text-xs text-slate-500 mt-2">
                Current tab is kept in sync when you change it in Account Management.
              </p>
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmDelete}
                onChange={(e) => setConfirmDelete(e.target.checked)}
                className="mt-1 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
              />
              <span className="text-sm text-slate-800 dark:text-slate-200">
                Ask for confirmation before deleting an account
              </span>
            </label>
            {!confirmDelete && (
              <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
                Disabling this will delete accounts immediately when Delete is clicked. Use only if you trust this device.
              </p>
            )}
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white text-sm font-semibold shadow"
            >
              Save workspace preferences
            </button>
          </div>
        </form>
      )}

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 text-sm text-green-800 dark:text-green-200">
          {success}
        </div>
      )}
    </div>
  );
}
