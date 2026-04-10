import React, { useMemo, useState } from 'react';

const dayOptions = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
];

export default function ClassScheduleSection({
  subjects,
  loadingSubjects,
  selectedSubject,
  subjectSchedules,
  onSelectSubject,
  onSaveSchedules,
}) {
  const [form, setForm] = useState({
    day_of_week: 1,
    start_time: '08:00',
    end_time: '10:00',
    late_grace_minutes: 15,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const schedules = useMemo(() => (subjectSchedules || []).map((s) => ({
    day_of_week: Number(s.day_of_week),
    start_time: String(s.start_time).slice(0, 5),
    end_time: String(s.end_time).slice(0, 5),
    late_grace_minutes: Number(s.late_grace_minutes || 15),
    is_active: true,
  })), [subjectSchedules]);

  const saveSlot = async () => {
    if (!selectedSubject) return;
    if (form.end_time <= form.start_time) {
      setMessage('End time must be after start time.');
      return;
    }

    const next = [
      ...schedules.filter((slot) => Number(slot.day_of_week) !== Number(form.day_of_week)),
      { ...form, day_of_week: Number(form.day_of_week), late_grace_minutes: Number(form.late_grace_minutes || 15), is_active: true },
    ];

    setSaving(true);
    setMessage('');
    const result = await onSaveSchedules(next);
    setSaving(false);
    setMessage(result?.ok ? 'Schedule saved.' : (result?.error || 'Failed to save schedule.'));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-indigo-200/60 bg-white/75 p-4 shadow-sm dark:border-indigo-800/40 dark:bg-slate-900/50">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Class Schedule</h3>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Manage class day/time for PIN attendance windows.</p>
        <div className="mt-3">
          <select
            value={selectedSubject?.id || ''}
            onChange={(e) => onSelectSubject(Number(e.target.value))}
            className="w-full max-w-md rounded-lg border border-slate-300 bg-white/90 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
            disabled={loadingSubjects}
          >
            <option value="">{loadingSubjects ? 'Loading subjects...' : 'Select a subject'}</option>
            {(subjects || []).map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name} ({subject.code}) - {subject.section}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedSubject && (
        <div className="rounded-2xl border border-slate-200 bg-white/60 p-4 dark:border-slate-700 dark:bg-slate-900/40">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Set or update schedule slot</h4>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">Day</label>
              <select
                value={form.day_of_week}
                onChange={(e) => setForm((prev) => ({ ...prev, day_of_week: Number(e.target.value) }))}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
              >
                {dayOptions.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">Start Time</label>
              <input type="time" value={form.start_time} onChange={(e) => setForm((prev) => ({ ...prev, start_time: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">End Time</label>
              <input type="time" value={form.end_time} onChange={(e) => setForm((prev) => ({ ...prev, end_time: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">Late Grace (minutes)</label>
              <input type="number" min="0" max="120" value={form.late_grace_minutes} onChange={(e) => setForm((prev) => ({ ...prev, late_grace_minutes: Number(e.target.value || 0) }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100" />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={saveSlot} disabled={saving} className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Schedule'}
            </button>
          </div>
          {message && <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{message}</p>}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white/60 p-4 dark:border-slate-700 dark:bg-slate-900/40">
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Active schedules</h4>
        {!selectedSubject ? (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Select a subject to view schedules.</p>
        ) : schedules.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No schedule set yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {schedules
              .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))
              .map((slot, idx) => (
                <div key={`${slot.day_of_week}-${slot.start_time}-${idx}`} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/50">
                  <span className="font-medium text-slate-800 dark:text-slate-100">{dayOptions.find((d) => d.value === slot.day_of_week)?.label || `Day ${slot.day_of_week}`}</span>
                  <span className="text-slate-700 dark:text-slate-300">{slot.start_time} - {slot.end_time}</span>
                  <span className="text-xs text-indigo-700 dark:text-indigo-300">Grace {slot.late_grace_minutes}m</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

