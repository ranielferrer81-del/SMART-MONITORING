import React, { useMemo, useState } from 'react';

export default function AttendanceSection({
  subjects,
  loadingSubjects,
  selectedSubject,
  enrolledStudents,
  loadingStudents,
  onSelectSubject,
  onMarkAttendance,
  onOpenHistory,
}) {
  const [reasonByStudent, setReasonByStudent] = useState({});
  const [savingStudentId, setSavingStudentId] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');

  const attendanceCounts = useMemo(() => {
    const base = { present: 0, late: 0, absent: 0 };
    (enrolledStudents || []).forEach((student) => {
      const summary = student.attendance_summary || {};
      base.present += Number(summary.present) || 0;
      base.late += Number(summary.late) || 0;
      base.absent += Number(summary.absent) || 0;
    });
    return base;
  }, [enrolledStudents]);

  const handleMark = async (studentId, status) => {
    setSavingStudentId(studentId);
    setStatusMessage('');
    const reason = (reasonByStudent[studentId] || '').trim() || null;
    const result = await onMarkAttendance(studentId, status, reason);
    if (!result?.ok) {
      setStatusMessage(result?.error || 'Failed to update attendance');
    } else {
      setStatusMessage('Attendance updated.');
      setReasonByStudent((prev) => ({ ...prev, [studentId]: '' }));
    }
    setSavingStudentId(null);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-rose-200/60 bg-white/75 p-4 shadow-sm dark:border-rose-800/40 dark:bg-slate-900/50">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Attendance Workspace</h3>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Choose a subject, then mark present/late/absent with optional note.</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={selectedSubject?.id || ''}
            onChange={(e) => onSelectSubject(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-300 bg-white/90 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100 sm:max-w-md"
            disabled={loadingSubjects}
          >
            <option value="">{loadingSubjects ? 'Loading subjects...' : 'Select a subject'}</option>
            {(subjects || []).map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name} ({subject.code}) - {subject.section}
              </option>
            ))}
          </select>
          {selectedSubject && (
            <span className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-900/30 dark:text-rose-200">
              {selectedSubject.course} | {selectedSubject.section}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-800/40 dark:bg-emerald-900/20">
          <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Present</p>
          <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">{attendanceCounts.present}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-800/40 dark:bg-amber-900/20">
          <p className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-300">Late</p>
          <p className="text-2xl font-bold text-amber-800 dark:text-amber-200">{attendanceCounts.late}</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3 dark:border-rose-800/40 dark:bg-rose-900/20">
          <p className="text-xs uppercase tracking-wide text-rose-700 dark:text-rose-300">Absent</p>
          <p className="text-2xl font-bold text-rose-800 dark:text-rose-200">{attendanceCounts.absent}</p>
        </div>
      </div>

      {statusMessage && (
        <div className="rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200">
          {statusMessage}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white/50 dark:border-slate-700 dark:bg-slate-900/40">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-100/60 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">Student</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">Email</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">Quick Note</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/70 dark:divide-slate-700/60">
            {!selectedSubject ? (
              <tr><td className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400" colSpan={4}>Select a subject to begin.</td></tr>
            ) : loadingStudents ? (
              <tr><td className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400" colSpan={4}>Loading students...</td></tr>
            ) : (enrolledStudents || []).length === 0 ? (
              <tr><td className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400" colSpan={4}>No enrolled students found for this subject.</td></tr>
            ) : (
              enrolledStudents.map((student) => (
                <tr key={student.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-slate-100">{student.full_name || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{student.email || '-'}</td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={reasonByStudent[student.id] || ''}
                      onChange={(e) => setReasonByStudent((prev) => ({ ...prev, [student.id]: e.target.value }))}
                      placeholder="Optional note"
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => handleMark(student.id, 'present')} disabled={savingStudentId === student.id} className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Present</button>
                      <button onClick={() => handleMark(student.id, 'late')} disabled={savingStudentId === student.id} className="rounded-md bg-amber-500 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Late</button>
                      <button onClick={() => handleMark(student.id, 'absent')} disabled={savingStudentId === student.id} className="rounded-md bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Absent</button>
                      <button onClick={() => onOpenHistory(student)} className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200">History</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

