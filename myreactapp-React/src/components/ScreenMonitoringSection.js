import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchScreenMonitorFrameBlobUrl,
  getScreenMonitorGrid,
} from '../api/screenMonitoring';
import { lockStudentPc, unlockStudentPc } from '../api/browserMonitoring';

const POLL_MS = 3000;

function LockPromptModal({ target, onClose, onSuccess }) {
  const [message, setMessage] = useState('This PC has been locked by your instructor.');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!target) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!target.computer_name) {
      setError('Computer name is missing for this student.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await lockStudentPc(target.computer_name, message.trim());
      if (res.ok) {
        onSuccess(target.computer_name, true);
        onClose();
      } else {
        setError(res.error || 'Failed to lock PC');
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700 relative text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Lock Student PC</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Restrict student access and show lock overlay
            </p>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 mb-4 border border-slate-200/80 dark:border-slate-700 text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Student:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">{target.full_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Computer:</span>
            <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{target.computer_name || 'N/A'}</span>
          </div>
          {target.laboratory_room && (
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Lab:</span>
              <span className="text-slate-700 dark:text-slate-300">{target.laboratory_room}</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
              Lock Message (Displayed to student)
            </label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter message for student screen..."
              className="w-full text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 resize-none"
              maxLength={500}
            />
            <p className="text-[11px] text-slate-400 mt-1 text-right">
              {message.length}/500
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-2.5 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Locking…
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Lock PC
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ScreenCard({ item, onSelect, selected, onLockRequest, onUnlockRequest, actionLoading }) {
  const [thumbUrl, setThumbUrl] = useState('');
  const blobRef = useRef('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!item.has_frame || item.is_stale) {
        if (blobRef.current) {
          URL.revokeObjectURL(blobRef.current);
          blobRef.current = '';
        }
        setThumbUrl('');
        return;
      }

      try {
        const url = await fetchScreenMonitorFrameBlobUrl(item.student_id);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        if (blobRef.current) {
          URL.revokeObjectURL(blobRef.current);
        }
        blobRef.current = url;
        setThumbUrl(url);
      } catch {
        if (!cancelled) setThumbUrl('');
      }
    };

    load();
    const id = setInterval(load, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = '';
      }
    };
  }, [item.student_id, item.has_frame, item.is_stale, item.captured_at]);

  const statusLabel = item.is_locked
    ? 'Locked'
    : !item.has_frame
      ? 'No capture'
      : item.is_stale
        ? 'Stale'
        : 'Live';

  const statusClass = item.is_locked
    ? 'bg-red-500 text-white font-bold animate-pulse'
    : !item.has_frame
      ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
      : item.is_stale
        ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200'
        : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-all duration-200 hover:shadow-lg ${
        item.is_locked
          ? 'border-red-500 ring-2 ring-red-400/40 shadow-red-500/10'
          : selected
            ? 'border-rose-500 ring-2 ring-rose-400/50 shadow-lg'
            : 'border-slate-200/80 dark:border-slate-700'
      } bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm flex flex-col`}
    >
      <button
        type="button"
        onClick={() => onSelect(item)}
        className="w-full text-left focus:outline-none flex-1 flex flex-col"
      >
        <div className="aspect-video bg-slate-900/90 relative w-full overflow-hidden group">
          {thumbUrl ? (
            <img
              src={thumbUrl}
              alt={`Screen — ${item.full_name}`}
              className="w-full h-full object-contain transition-transform group-hover:scale-[1.02] duration-300"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 px-4 text-center">
              <svg className="w-10 h-10 mb-2 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="text-xs">Waiting for screen frame…</span>
            </div>
          )}

          {/* Locked banner on screen overlay if locked */}
          {item.is_locked && (
            <div className="absolute inset-0 bg-red-950/70 backdrop-blur-[2px] flex flex-col items-center justify-center text-white p-2 text-center">
              <div className="w-8 h-8 rounded-full bg-red-600/80 flex items-center justify-center mb-1 shadow-lg">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <span className="text-xs font-bold tracking-wider uppercase">PC Locked</span>
            </div>
          )}

          <span className={`absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full shadow ${statusClass}`}>
            {statusLabel}
          </span>
        </div>

        <div className="p-3 space-y-1.5 flex-1">
          <p className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate" title={item.full_name}>
            {item.full_name}
          </p>
          <div className="space-y-1">
            {item.computer_name && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                <svg className="w-3.5 h-3.5 flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="font-medium uppercase tracking-wide opacity-60">PC:</span>
                <span className="truncate font-mono font-semibold">{item.computer_name}</span>
              </div>
            )}
            {item.laboratory_room && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                <svg className="w-3.5 h-3.5 flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span className="font-medium uppercase tracking-wide opacity-60">Lab:</span>
                <span className="truncate">{item.laboratory_room}</span>
              </div>
            )}
            {!item.computer_name && !item.laboratory_room && (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic">No PC location data</p>
            )}
          </div>
        </div>
      </button>

      {/* Action Footer: Lock / Unlock button */}
      {item.computer_name && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2">
          {item.is_locked ? (
            <button
              type="button"
              disabled={actionLoading === item.computer_name}
              onClick={(e) => {
                e.stopPropagation();
                onUnlockRequest(item.computer_name);
              }}
              className="w-full py-1.5 px-3 text-xs font-semibold rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
              {actionLoading === item.computer_name ? 'Unlocking…' : 'Unlock PC'}
            </button>
          ) : (
            <button
              type="button"
              disabled={actionLoading === item.computer_name}
              onClick={(e) => {
                e.stopPropagation();
                onLockRequest(item);
              }}
              className="w-full py-1.5 px-3 text-xs font-semibold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Lock PC
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ScreenMonitorModal({ student, onClose, onLockRequest, onUnlockRequest, actionLoading }) {
  const [largeUrl, setLargeUrl] = useState('');
  const blobRef = useRef('');

  useEffect(() => {
    if (!student) return undefined;

    let cancelled = false;

    const load = async () => {
      if (!student.has_frame) {
        setLargeUrl('');
        return;
      }
      try {
        const url = await fetchScreenMonitorFrameBlobUrl(student.student_id);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        if (blobRef.current) URL.revokeObjectURL(blobRef.current);
        blobRef.current = url;
        setLargeUrl(url);
      } catch {
        if (!cancelled) setLargeUrl('');
      }
    };

    load();
    const id = setInterval(load, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = '';
      }
    };
  }, [student]);

  if (!student) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">{student.full_name}</h3>
              {student.is_locked && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-500 text-white uppercase tracking-wider animate-pulse">
                  🔒 Locked
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
              {student.computer_name && (
                <span className="inline-flex items-center gap-1.5">
                  <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="font-semibold uppercase tracking-wider text-[10px] opacity-60">PC</span>
                  <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{student.computer_name}</span>
                </span>
              )}
              {student.laboratory_room && (
                <span className="inline-flex items-center gap-1.5">
                  <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className="font-semibold uppercase tracking-wider text-[10px] opacity-60">Lab</span>
                  <span>{student.laboratory_room}</span>
                </span>
              )}
              {!student.computer_name && !student.laboratory_room && (
                <span className="italic text-slate-400 dark:text-slate-500">No PC location data</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {student.computer_name && (
              student.is_locked ? (
                <button
                  type="button"
                  disabled={actionLoading === student.computer_name}
                  onClick={() => onUnlockRequest(student.computer_name)}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                  </svg>
                  {actionLoading === student.computer_name ? 'Unlocking…' : 'Unlock this PC'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={actionLoading === student.computer_name}
                  onClick={() => onLockRequest(student)}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Lock this PC
                </button>
              )
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 p-4 bg-slate-950 flex items-center justify-center relative">
          {largeUrl ? (
            <img src={largeUrl} alt="Student screen" className="max-w-full max-h-[70vh] object-contain" />
          ) : (
            <p className="text-slate-400 text-sm">No screen capture available for this student yet.</p>
          )}

          {student.is_locked && (
            <div className="absolute top-4 left-4 bg-red-950/80 border border-red-500/60 rounded-xl px-4 py-2.5 backdrop-blur-md text-white shadow-xl flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-red-300">Lock Overlay Active</p>
                <p className="text-xs text-white/80">{student.lock_message || 'This PC has been locked.'}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


export default function ScreenMonitoringSection({
  allowedStudentIds = null,
  headerOverride = null,
  onBack = null,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [labFilter, setLabFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [lockTarget, setLockTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState('');

  const allowedSet = useMemo(() => {
    if (!Array.isArray(allowedStudentIds)) return null;
    return new Set(allowedStudentIds.map((id) => Number(id)));
  }, [allowedStudentIds]);

  const loadGrid = useCallback(async () => {
    try {
      const res = await getScreenMonitorGrid(
        labFilter.trim() ? { laboratory_room: labFilter.trim() } : {},
      );
      if (res.ok && res.data?.data) {
        setItems(Array.isArray(res.data.data) ? res.data.data : []);
        setError('');
      } else {
        setError(res.error || 'Failed to load screen monitoring grid');
      }
    } catch (e) {
      setError(e.message || 'Failed to load screen monitoring grid');
    } finally {
      setLoading(false);
    }
  }, [labFilter]);

  useEffect(() => {
    loadGrid();
    const id = setInterval(loadGrid, POLL_MS);
    return () => clearInterval(id);
  }, [loadGrid]);

  const handleLockSuccess = (computerName, isLocked) => {
    setItems((prev) =>
      prev.map((i) =>
        i.computer_name === computerName ? { ...i, is_locked: isLocked } : i
      )
    );
    if (selected && selected.computer_name === computerName) {
      setSelected((prev) => ({ ...prev, is_locked: isLocked }));
    }
    setActionSuccess(`Computer ${computerName} is now locked.`);
    setTimeout(() => setActionSuccess(''), 4000);
    loadGrid();
  };

  const handleUnlock = async (computerName) => {
    if (!computerName) return;
    setActionLoading(computerName);
    setError('');
    try {
      const res = await unlockStudentPc(computerName);
      if (res.ok) {
        setItems((prev) =>
          prev.map((i) =>
            i.computer_name === computerName ? { ...i, is_locked: false } : i
          )
        );
        if (selected && selected.computer_name === computerName) {
          setSelected((prev) => ({ ...prev, is_locked: false }));
        }
        setActionSuccess(`Computer ${computerName} has been unlocked.`);
        setTimeout(() => setActionSuccess(''), 4000);
        loadGrid();
      } else {
        setError(res.error || 'Failed to unlock PC');
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred while unlocking');
    } finally {
      setActionLoading('');
    }
  };

  const labOptions = useMemo(() => {
    const set = new Set();
    items.forEach((i) => {
      if (i.laboratory_room) set.add(i.laboratory_room);
    });
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    let list = items;
    if (allowedSet !== null) {
      list = list.filter((i) => allowedSet.has(Number(i.student_id)));
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (i) =>
        (i.full_name || '').toLowerCase().includes(q) ||
        (i.computer_name || '').toLowerCase().includes(q) ||
        (i.email || '').toLowerCase().includes(q),
    );
  }, [items, search, allowedSet]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end gap-4">
        <div className="flex-1">
          {headerOverride ? (
            headerOverride
          ) : (
            <>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Lab screen monitoring</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Live desktop thumbnails from students signed in on the lab PC app. Updates every few seconds.
              </p>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white/80 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to subjects
            </button>
          )}
          <input
            type="search"
            placeholder="Search name or PC…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white/80 dark:bg-slate-800 px-3 py-2 text-sm min-w-[180px]"
          />
          <select
            value={labFilter}
            onChange={(e) => setLabFilter(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white/80 dark:bg-slate-800 px-3 py-2 text-sm"
          >
            <option value="">All laboratories</option>
            {labOptions.map((lab) => (
              <option key={lab} value={lab}>
                {lab}
              </option>
            ))}
          </select>
        </div>
      </div>

      {actionSuccess && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-700 text-red-800 dark:text-red-200 px-4 py-3 text-sm flex items-center gap-2 shadow-sm animate-fadeIn">
          <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="text-center py-16 text-slate-500 dark:text-slate-400">Loading screen grid…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500 dark:text-slate-400 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600">
          No online students with screen monitoring right now. Students must be logged in on the Desktop App.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filtered.map((item) => (
            <ScreenCard
              key={item.student_id}
              item={item}
              selected={selected?.student_id === item.student_id}
              onSelect={setSelected}
              onLockRequest={setLockTarget}
              onUnlockRequest={handleUnlock}
              actionLoading={actionLoading}
            />
          ))}
        </div>
      )}

      {selected && (
        <ScreenMonitorModal
          student={selected}
          onClose={() => setSelected(null)}
          onLockRequest={setLockTarget}
          onUnlockRequest={handleUnlock}
          actionLoading={actionLoading}
        />
      )}

      {lockTarget && (
        <LockPromptModal
          target={lockTarget}
          onClose={() => setLockTarget(null)}
          onSuccess={handleLockSuccess}
        />
      )}
    </div>
  );
}



