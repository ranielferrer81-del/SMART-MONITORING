import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getMonitoringTimeStudents,
  getMonitoringTimeSessionsForDate,
} from '../api/browserMonitoring';
import { formatMonitoringDateTime } from '../utils/monitoringDisplay';

function todayLocalISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Admin + teacher: browse students by course/section; open per-student time-in/out history by date.
 */
export default function StudentsTimeClockSection() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [historyStudent, setHistoryStudent] = useState(null);
  const [historyDate, setHistoryDate] = useState(() => todayLocalISO());
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionError, setSessionError] = useState('');

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const res = await getMonitoringTimeStudents();
    setLoading(false);
    if (!res.ok) {
      setLoadError(res.error || 'Failed to load students');
      setStudents([]);
      return;
    }
    const list = Array.isArray(res.data?.data) ? res.data.data : [];
    setStudents(list);
  }, []);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  const grouped = useMemo(() => {
    const g = {};
    for (const s of students) {
      const course = (s.course && String(s.course).trim()) || 'Unknown course';
      const section = (s.section && String(s.section).trim()) || '—';
      if (!g[course]) g[course] = {};
      if (!g[course][section]) g[course][section] = [];
      g[course][section].push(s);
    }
    const courses = Object.keys(g).sort();
    const out = {};
    for (const c of courses) {
      const sections = Object.keys(g[c]).sort();
      out[c] = {};
      for (const sec of sections) {
        out[c][sec] = g[c][sec].sort((a, b) =>
          (a.full_name || '').localeCompare(b.full_name || '')
        );
      }
    }
    return out;
  }, [students]);

  const openHistory = (student) => {
    setHistoryStudent(student);
    setHistoryDate(todayLocalISO());
    setSessions([]);
    setSessionError('');
  };

  const fetchSessions = useCallback(async () => {
    if (!historyStudent) return;
    setLoadingSessions(true);
    setSessionError('');
    const res = await getMonitoringTimeSessionsForDate(historyStudent.id, historyDate);
    setLoadingSessions(false);
    if (!res.ok) {
      setSessionError(res.error || 'Could not load history');
      setSessions([]);
      return;
    }
    const list = Array.isArray(res.data?.data) ? res.data.data : [];
    setSessions(list);
  }, [historyStudent, historyDate]);

  useEffect(() => {
    if (historyStudent) {
      void fetchSessions();
    }
  }, [historyStudent, historyDate, fetchSessions]);

  return (
    <div className="min-w-0 space-y-6">
      <div className="rounded-2xl border border-slate-200/60 bg-white/20 p-4 shadow-sm backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-900/30 sm:p-6">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
          Students — time-in &amp; time-out
        </h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Grouped by course and section (from each student&apos;s profile). Choose a student, then pick a
          date to see all monitoring sessions that day (PC login time when available, logout when the session
          ended).
        </p>
        <button
          type="button"
          onClick={() => void loadStudents()}
          disabled={loading}
          className="mt-3 rounded-xl border border-rose-200/80 bg-rose-50/80 px-4 py-2 text-sm font-semibold text-rose-800 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-800/60 dark:bg-rose-900/30 dark:text-rose-200 dark:hover:bg-rose-900/50"
        >
          {loading ? 'Refreshing…' : 'Refresh list'}
        </button>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
          {loadError}
        </div>
      )}

      {loading && students.length === 0 ? (
        <div className="py-16 text-center text-slate-500 dark:text-slate-400">Loading students…</div>
      ) : students.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/60 bg-white/10 p-12 text-center dark:border-slate-700/60">
          <p className="text-slate-600 dark:text-slate-400">No students available for your account.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([course, sections]) => (
            <div key={course} className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white/15 shadow-md backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-900/25">
              <div className="border-b border-slate-200/60 bg-gradient-to-r from-rose-500/15 to-red-500/10 px-4 py-3 dark:border-slate-700/60">
                <h4 className="text-base font-bold text-rose-700 dark:text-rose-300">{course}</h4>
              </div>
              <div className="divide-y divide-slate-200/50 dark:divide-slate-700/50">
                {Object.entries(sections).map(([section, list]) => (
                  <div key={`${course}-${section}`} className="p-4 sm:p-6">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100/90 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        Section {section}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {list.length} student{list.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                      <table className="min-w-full divide-y divide-slate-200/60 dark:divide-slate-700/60">
                        <thead className="bg-slate-50/80 dark:bg-slate-800/50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-bold uppercase text-slate-600 dark:text-slate-400">
                              Name
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-bold uppercase text-slate-600 dark:text-slate-400">
                              Email
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-bold uppercase text-slate-600 dark:text-slate-400">
                              Student #
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-bold uppercase text-slate-600 dark:text-slate-400">
                              History
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/50 dark:divide-slate-700/50">
                          {list.map((row) => (
                            <tr key={row.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/30">
                              <td className="whitespace-nowrap px-4 py-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                                {row.full_name || '—'}
                              </td>
                              <td className="max-w-[200px] truncate px-4 py-2 text-sm text-slate-600 dark:text-slate-400">
                                {row.email || '—'}
                              </td>
                              <td className="whitespace-nowrap px-4 py-2 text-sm text-slate-600 dark:text-slate-400">
                                {row.student_number || '—'}
                              </td>
                              <td className="whitespace-nowrap px-4 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => openHistory(row)}
                                  className="rounded-lg bg-gradient-to-r from-rose-600 to-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:from-rose-700 hover:to-red-700"
                                >
                                  View by date
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {historyStudent &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 p-3 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            onClick={() => setHistoryStudent(null)}
          >
            <div
              className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-white/20 bg-white/95 shadow-2xl dark:border-slate-600 dark:bg-slate-900/95"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-slate-700">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">
                    Time-in / time-out history
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {historyStudent.full_name} · {historyStudent.course} · Section {historyStudent.section}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryStudent(null)}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label="Close"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-4 border-b border-slate-200/80 px-5 py-4 dark:border-slate-700">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Date
                  <input
                    type="date"
                    value={historyDate}
                    onChange={(e) => setHistoryDate(e.target.value)}
                    className="mt-1 w-full max-w-xs rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void fetchSessions()}
                  disabled={loadingSessions}
                  className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600"
                >
                  {loadingSessions ? 'Loading…' : 'Reload this date'}
                </button>
                {sessionError && (
                  <p className="text-sm text-red-600 dark:text-red-400">{sessionError}</p>
                )}
              </div>
              <div className="max-h-[50vh] overflow-y-auto px-5 py-4">
                {loadingSessions && sessions.length === 0 ? (
                  <p className="py-8 text-center text-slate-500">Loading sessions…</p>
                ) : sessions.length === 0 ? (
                  <p className="py-8 text-center text-slate-500 dark:text-slate-400">
                    No sessions recorded for this date.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left dark:border-slate-700">
                        <th className="pb-2 pr-2 font-semibold text-slate-700 dark:text-slate-300">Time in</th>
                        <th className="pb-2 pr-2 font-semibold text-slate-700 dark:text-slate-300">Time out</th>
                        <th className="pb-2 font-semibold text-slate-700 dark:text-slate-300">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((s) => (
                        <tr key={s.id} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="py-2 pr-2 text-slate-800 dark:text-slate-200">
                            {formatMonitoringDateTime(s.time_in)}
                          </td>
                          <td className="py-2 pr-2 text-slate-800 dark:text-slate-200">
                            {s.time_out ? formatMonitoringDateTime(s.time_out) : 'Still active'}
                          </td>
                          <td className="py-2">
                            {s.is_active ? (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                                Active
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                                Ended
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
