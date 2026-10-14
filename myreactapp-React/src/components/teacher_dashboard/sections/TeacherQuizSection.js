import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  listQuizzes,
  getQuiz,
  generateQuizFromModule,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  startQuiz,
  endQuiz,
  getQuizProctor,
  quizErrorMessage,
} from '../../../api/quizzes';

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

const STATUS_STYLES = {
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  closed: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
};

const ATTEMPT_STYLES = {
  not_started: { label: 'Not started', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  in_progress: { label: 'Answering…', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  completed: { label: 'Submitted', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  timed_out: { label: 'Timed out', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' },
};

let keyCounter = 0;
const nextKey = () => `q${Date.now()}_${keyCounter++}`;

const blankQuestion = () => ({
  key: nextKey(),
  question_text: '',
  options: ['', '', '', ''],
  correctIndex: 0,
  explanation: '',
});

const fromApiQuestion = (q) => {
  const options = Array.isArray(q.options) ? q.options.map(String) : [];
  const idx = options.findIndex((o) => o === q.correct_answer);
  return {
    key: nextKey(),
    question_text: q.question_text || '',
    options,
    correctIndex: idx >= 0 ? idx : 0,
    explanation: q.explanation || '',
  };
};

const emptyEditor = (subjectId) => ({
  id: null,
  step: 'source', // source | review
  subjectId: subjectId || '',
  title: '',
  description: '',
  timeLimit: 15,
  passing: 60,
  moduleFilename: null,
  moduleText: '',
  file: null,
  questionCount: 10,
  difficulty: 'medium',
  questions: [],
  aiSource: null,
});

/** Returns an error string if the questions can't be saved, else null. */
function validateQuestions(questions) {
  if (!questions.length) return 'Add at least one question.';
  for (let i = 0; i < questions.length; i += 1) {
    const q = questions[i];
    const n = i + 1;
    if (!q.question_text.trim()) return `Question ${n} is empty.`;
    const opts = q.options.map((o) => o.trim());
    if (opts.length < 2) return `Question ${n} needs at least 2 options.`;
    if (opts.some((o) => !o)) return `Question ${n} has an empty option.`;
    if (new Set(opts).size !== opts.length) return `Question ${n} has duplicate options.`;
    if (!opts[q.correctIndex]) return `Question ${n} has no correct answer selected.`;
  }
  return null;
}

export default function TeacherQuizSection({ subjects = [] }) {
  const [subjectId, setSubjectId] = useState('');
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState(null); // {type:'ok'|'error', text}
  const [busyId, setBusyId] = useState(null);
  const [editor, setEditor] = useState(null);
  const [editorError, setEditorError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [proctorId, setProctorId] = useState(null);
  const [inputTab, setInputTab] = useState('file');
  const fileRef = useRef(null);
  const flashTimerRef = useRef(null);

  // Close modals on Escape key
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (editor && !generating && !saving) {
          setEditor(null);
          setEditorError('');
        }
        if (proctorId) {
          setProctorId(null);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editor, generating, saving, proctorId]);

  // Default to first subject once subjects load
  useEffect(() => {
    if (!subjectId && subjects.length > 0) setSubjectId(String(subjects[0].id));
  }, [subjects, subjectId]);

  const subjectById = useMemo(() => {
    const m = {};
    subjects.forEach((s) => { m[String(s.id)] = s; });
    return m;
  }, [subjects]);

  const showFlash = useCallback((type, text) => {
    setFlash({ type, text });
    window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlash(null), 5000);
  }, []);

  const refresh = useCallback(async () => {
    if (!subjectId) { setQuizzes([]); return; }
    setLoading(true);
    try {
      const res = await listQuizzes(subjectId);
      setQuizzes(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      showFlash('error', quizErrorMessage(err, 'Could not load quizzes.'));
    } finally {
      setLoading(false);
    }
  }, [subjectId, showFlash]);

  useEffect(() => { refresh(); }, [refresh]);

  // Keep counts fresh while any quiz is running
  const hasActive = quizzes.some((q) => q.status === 'active');
  useEffect(() => {
    if (!hasActive) return undefined;
    const t = window.setInterval(refresh, 5000);
    return () => window.clearInterval(t);
  }, [hasActive, refresh]);

  // ───────── editor actions ─────────

  const openCreate = () => {
    setEditorError('');
    setEditor(emptyEditor(subjectId));
  };

  const closeEditor = () => {
    if (generating || saving) return;
    setEditor(null);
    setEditorError('');
  };

  const openEdit = async (quiz) => {
    setBusyId(quiz.id);
    try {
      const res = await getQuiz(quiz.id);
      const d = res?.data;
      setEditorError('');
      setEditor({
        ...emptyEditor(String(d.subject_id || subjectId)),
        id: d.id,
        step: 'review',
        title: d.title || '',
        description: d.description || '',
        timeLimit: d.time_limit_minutes ?? 15,
        passing: d.passing_percentage ?? 60,
        moduleFilename: d.module_filename || null,
        questions: (d.questions || []).map(fromApiQuestion),
      });
    } catch (err) {
      showFlash('error', quizErrorMessage(err, 'Could not open quiz.'));
    } finally {
      setBusyId(null);
    }
  };

  const patchEditor = (patch) => setEditor((e) => ({ ...e, ...patch }));

  const patchQuestion = (key, patch) =>
    setEditor((e) => ({ ...e, questions: e.questions.map((q) => (q.key === key ? { ...q, ...patch } : q)) }));

  const setOption = (key, idx, value) =>
    setEditor((e) => ({
      ...e,
      questions: e.questions.map((q) => {
        if (q.key !== key) return q;
        const options = q.options.slice();
        options[idx] = value;
        return { ...q, options };
      }),
    }));

  const addOption = (key) =>
    setEditor((e) => ({
      ...e,
      questions: e.questions.map((q) => (q.key === key && q.options.length < 6 ? { ...q, options: [...q.options, ''] } : q)),
    }));

  const removeOption = (key, idx) =>
    setEditor((e) => ({
      ...e,
      questions: e.questions.map((q) => {
        if (q.key !== key || q.options.length <= 2) return q;
        const options = q.options.filter((_, i) => i !== idx);
        let correctIndex = q.correctIndex;
        if (idx === correctIndex) correctIndex = 0;
        else if (idx < correctIndex) correctIndex -= 1;
        return { ...q, options, correctIndex };
      }),
    }));

  const removeQuestion = (key) =>
    setEditor((e) => ({ ...e, questions: e.questions.filter((q) => q.key !== key) }));

  const addQuestion = () =>
    setEditor((e) => ({ ...e, questions: [...e.questions, blankQuestion()] }));

  const handleGenerate = async () => {
    setEditorError('');
    if (!editor.subjectId) { setEditorError('Please choose a subject.'); return; }
    if (!editor.moduleText.trim() && !editor.file) {
      setEditorError('Paste your module text or upload a file first.');
      return;
    }
    setGenerating(true);
    try {
      const res = await generateQuizFromModule({
        moduleText: editor.moduleText.trim(),
        file: editor.file,
        questionCount: Number(editor.questionCount) || 10,
        difficulty: editor.difficulty,
        title: editor.title.trim(),
      });
      if (!res?.ok) throw new Error(res?.message || 'Generation failed.');
      const d = res.data;
      setEditor((e) => ({
        ...e,
        step: 'review',
        title: e.title.trim() || d.title || 'Module Quiz',
        moduleFilename: d.module_filename || e.file?.name || null,
        questions: (d.questions || []).map(fromApiQuestion),
        aiSource: d.source || null,
      }));
    } catch (err) {
      setEditorError(quizErrorMessage(err, 'Could not generate the quiz.'));
    } finally {
      setGenerating(false);
    }
  };

  const startManual = () => {
    setEditorError('');
    if (!editor.subjectId) { setEditorError('Please choose a subject.'); return; }
    setEditor((e) => ({ ...e, step: 'review', questions: e.questions.length ? e.questions : [blankQuestion()] }));
  };

  const handleSave = async () => {
    setEditorError('');
    if (!editor.title.trim()) { setEditorError('Please enter a quiz title.'); return; }
    const problem = validateQuestions(editor.questions);
    if (problem) { setEditorError(problem); return; }

    const payload = {
      subject_id: Number(editor.subjectId),
      title: editor.title.trim(),
      description: editor.description.trim() || null,
      module_filename: editor.moduleFilename || null,
      time_limit_minutes: Math.max(0, Number(editor.timeLimit) || 0),
      passing_percentage: Math.min(100, Math.max(0, Number(editor.passing) || 0)),
      questions: editor.questions.map((q) => {
        const options = q.options.map((o) => o.trim());
        return {
          question_text: q.question_text.trim(),
          options,
          correct_answer: options[q.correctIndex],
          explanation: q.explanation.trim() || null,
        };
      }),
    };

    setSaving(true);
    try {
      const res = editor.id ? await updateQuiz(editor.id, payload) : await createQuiz(payload);
      if (!res?.ok) throw new Error(res?.message || 'Save failed.');
      setEditor(null);
      if (String(payload.subject_id) !== String(subjectId)) setSubjectId(String(payload.subject_id));
      else await refresh();
      showFlash('ok', 'Quiz saved as draft. Press "Launch" when you are ready.');
    } catch (err) {
      setEditorError(quizErrorMessage(err, 'Could not save the quiz.'));
    } finally {
      setSaving(false);
    }
  };

  // ───────── list actions ─────────

  const runAction = async (quiz, fn, okText) => {
    setBusyId(quiz.id);
    try {
      const res = await fn(quiz.id);
      if (res && res.ok === false) throw new Error(res.message || 'Action failed.');
      showFlash('ok', okText);
      await refresh();
    } catch (err) {
      showFlash('error', quizErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleLaunch = (quiz) => {
    const subj = subjectById[String(quiz.subject_id)];
    const where = subj ? `${subj.code} (${subj.section})` : 'the class';
    if (!window.confirm(`Launch "${quiz.title}" now?\n\nEvery enrolled student in ${where} who is logged into the Desktop App will be locked into the quiz screen until they submit.`)) return;
    runAction(quiz, startQuiz, 'Quiz launched. Student screens are locking now.');
  };

  const handleEnd = (quiz) => {
    if (!window.confirm(`End "${quiz.title}" for everyone?\n\nStudents still answering will be released immediately and marked as timed out.`)) return;
    runAction(quiz, endQuiz, 'Quiz ended. Students have been released.');
  };

  const handleDelete = (quiz) => {
    if (!window.confirm(`Delete "${quiz.title}" and all student results? This cannot be undone.`)) return;
    runAction(quiz, deleteQuiz, 'Quiz deleted.');
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-white/40 bg-white/60 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/50">
        <div className="min-w-[220px] flex-1 sm:max-w-sm">
          <label htmlFor="quiz-subject" className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Subject</label>
          <select
            id="quiz-subject"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            {subjects.length === 0 && <option value="">No subjects assigned</option>}
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.code} — {s.name} ({s.section})</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          id="create-quiz-btn"
          onClick={openCreate}
          disabled={subjects.length === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-500 via-rose-500 to-rose-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Create Quiz with AI
        </button>
      </div>

      {flash && (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm font-medium ${flash.type === 'ok'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-200'
            : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-200'}`}
        >
          {flash.text}
        </div>
      )}

      {/* Quiz list */}
      {loading && quizzes.length === 0 ? (
        <div className="py-12 text-center text-slate-600 dark:text-slate-400">Loading quizzes…</div>
      ) : quizzes.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/60 bg-white/10 p-12 text-center shadow-xl backdrop-blur-sm dark:border-slate-800/60 dark:bg-slate-900/10">
          <svg className="mx-auto mb-4 h-16 w-16 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          <div className="mb-1 text-base font-semibold text-slate-500 dark:text-slate-400">No quizzes yet for this subject</div>
          <div className="text-sm text-slate-400 dark:text-slate-500">Upload a module and let AI draft a quiz you can review and launch to your class.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {quizzes.map((q) => {
            const busy = busyId === q.id;
            return (
              <div key={q.id} className="rounded-2xl border border-white/30 bg-white/50 p-5 shadow-lg backdrop-blur-md transition hover:shadow-xl dark:border-white/5 dark:bg-slate-800/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-bold text-slate-800 dark:text-slate-100" title={q.title}>{q.title}</h3>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {q.question_count} question{q.question_count !== 1 ? 's' : ''} · {q.time_limit_minutes > 0 ? `${q.time_limit_minutes} min` : 'No time limit'} · pass {q.passing_percentage}%
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${STATUS_STYLES[q.status] || STATUS_STYLES.draft}`}>
                    {q.status === 'active' ? '● Live' : q.status}
                  </span>
                </div>

                {q.status !== 'draft' && (
                  <div className="mt-3 flex gap-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <span>Answering: <b className="text-amber-600 dark:text-amber-300">{q.in_progress_count}</b></span>
                    <span>Finished: <b className="text-emerald-600 dark:text-emerald-300">{q.completed_count}</b></span>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {q.status === 'draft' && (
                    <>
                      <button type="button" disabled={busy} onClick={() => handleLaunch(q)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">🚀 Launch to class</button>
                      <button type="button" disabled={busy} onClick={() => openEdit(q)} className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-300 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600">✏️ Edit</button>
                    </>
                  )}
                  {q.status === 'active' && (
                    <>
                      <button type="button" onClick={() => setProctorId(q.id)} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700">👁 Live proctor</button>
                      <button type="button" disabled={busy} onClick={() => handleEnd(q)} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-900 disabled:opacity-50 dark:bg-slate-600">⏹ End quiz</button>
                    </>
                  )}
                  {q.status === 'closed' && (
                    <button type="button" onClick={() => setProctorId(q.id)} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700">📊 View results</button>
                  )}
                  {q.status !== 'active' && (
                    <button type="button" disabled={busy} onClick={() => handleDelete(q)} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20">🗑 Delete</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / edit modal - Portaled directly to body with z-[9999] so it is NEVER clipped or covered */}
      {editor && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-3 sm:p-5 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeEditor();
          }}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with ultra-clear title and close button */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-md">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    {editor.id ? 'Edit Quiz' : editor.step === 'source' ? 'Create Quiz with AI' : 'Review & Finalize Quiz'}
                  </h3>
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${editor.step === 'source' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                      Step 1: Module Source
                    </span>
                    <span>→</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${editor.step === 'review' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                      Step 2: Questions & Settings
                    </span>
                  </div>
                </div>
              </div>

              {/* Close Button - prominent and cannot be missed */}
              <button
                type="button"
                onClick={closeEditor}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors"
                title="Close (Esc)"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              {editorError && (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-200 flex items-start gap-3">
                  <span className="text-lg">⚠️</span>
                  <div className="flex-1">{editorError}</div>
                  <button type="button" onClick={() => setEditorError('')} className="text-red-500 hover:text-red-700 font-bold text-xs">Dismiss</button>
                </div>
              )}

              {/* Core Quiz Settings */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Assigned Subject</label>
                  <select value={editor.subjectId} onChange={(e) => patchEditor({ subjectId: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 shadow-sm">
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name} ({s.section})</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Time Limit</label>
                  <div className="flex items-center gap-1.5">
                    <input type="number" min="0" max="300" value={editor.timeLimit} onChange={(e) => patchEditor({ timeLimit: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 shadow-sm" />
                    <span className="text-xs font-bold text-slate-400">min</span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-400">0 = no timer limit</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Passing Score</label>
                  <div className="flex items-center gap-1.5">
                    <input type="number" min="0" max="100" value={editor.passing} onChange={(e) => patchEditor({ passing: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 shadow-sm" />
                    <span className="text-xs font-bold text-slate-400">%</span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-400">Default: 60%</p>
                </div>
              </div>

              {editor.step === 'source' && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Quiz Title (Optional)</label>
                    <input
                      type="text"
                      maxLength={255}
                      value={editor.title}
                      onChange={(e) => patchEditor({ title: e.target.value })}
                      placeholder="e.g. Chapter 2 — Rizal's Life and Philippine Society"
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 shadow-sm"
                    />
                  </div>

                  {/* Module Input Tabs: Upload File vs Paste Text */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                        Lesson Module Source
                      </label>
                      <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                        <button
                          type="button"
                          onClick={() => setInputTab('file')}
                          className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${inputTab === 'file' ? 'bg-white shadow-sm text-rose-600 dark:bg-slate-700 dark:text-rose-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                        >
                          📄 Upload File
                        </button>
                        <button
                          type="button"
                          onClick={() => setInputTab('text')}
                          className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${inputTab === 'text' ? 'bg-white shadow-sm text-rose-600 dark:bg-slate-700 dark:text-rose-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                        >
                          ✍️ Paste Notes / Text
                        </button>
                      </div>
                    </div>

                    {/* Tab 1: Upload File */}
                    {inputTab === 'file' && (
                      <div>
                        <input
                          ref={fileRef}
                          type="file"
                          accept=".pdf,.docx,.txt,.md"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0] || null;
                            if (f && f.size > 50 * 1024 * 1024) {
                              setEditorError('The selected file exceeds 50MB. Please choose a file under 50MB.');
                              e.target.value = '';
                              return;
                            }
                            patchEditor({ file: f });
                          }}
                        />

                        {editor.file ? (
                          <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 p-5 dark:border-emerald-800/60 dark:bg-emerald-950/20">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white font-extrabold text-sm shadow">
                                  {editor.file.name.split('.').pop()?.toUpperCase() || 'FILE'}
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-bold text-slate-800 dark:text-slate-100 max-w-md">
                                    {editor.file.name}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                    <span>{formatBytes(editor.file.size)}</span>
                                    <span>•</span>
                                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">✓ Ready for AI generation</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => fileRef.current?.click()}
                                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                >
                                  Change file
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    patchEditor({ file: null });
                                    if (fileRef.current) fileRef.current.value = '';
                                  }}
                                  className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:border-red-800 dark:bg-slate-800 dark:text-red-400"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => fileRef.current?.click()}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const f = e.dataTransfer.files?.[0] || null;
                              if (f && f.size > 50 * 1024 * 1024) {
                                setEditorError('The selected file exceeds 50MB.');
                                return;
                              }
                              if (f) patchEditor({ file: f });
                            }}
                            className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-8 text-center hover:border-rose-400 hover:bg-rose-50/20 dark:border-slate-700 dark:bg-slate-800/30 dark:hover:border-rose-500 transition-all group"
                          >
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-soft text-rose-500 group-hover:scale-110 transition-transform dark:bg-slate-800">
                              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                              </svg>
                            </div>
                            <div className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-100">
                              Click to browse or drag and drop your module file here
                            </div>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              Supports <strong className="text-slate-700 dark:text-slate-300">PDF, Word (.docx), TXT, Markdown</strong> (up to 50MB)
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab 2: Paste Text */}
                    {inputTab === 'text' && (
                      <div>
                        <textarea
                          rows={8}
                          value={editor.moduleText}
                          onChange={(e) => patchEditor({ moduleText: e.target.value })}
                          placeholder="Paste lesson chapters, lecture slides notes, or syllabus content here..."
                          className="w-full rounded-2xl border border-slate-200 p-4 text-sm font-normal text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 shadow-sm"
                        />
                        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                          <span>Paste at least 2–3 paragraphs for optimal question generation.</span>
                          <span>{editor.moduleText.length} characters</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* AI Generation Controls */}
                  <div className="grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Number of Questions</label>
                      <select value={editor.questionCount} onChange={(e) => patchEditor({ questionCount: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 shadow-sm">
                        {[5, 10, 15, 20, 25, 30].map((n) => <option key={n} value={n}>{n} Questions</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Question Difficulty</label>
                      <select value={editor.difficulty} onChange={(e) => patchEditor({ difficulty: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 shadow-sm">
                        <option value="easy">Easy (Definitions & basic facts)</option>
                        <option value="medium">Medium (Concepts & application)</option>
                        <option value="hard">Hard (Analysis & critical thinking)</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {editor.step === 'review' && (
                <>
                  {editor.aiSource === 'offline' && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-200">
                      These questions were drafted with the built-in offline generator (no AI key configured). Please review each one carefully.
                    </div>
                  )}
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Quiz title</label>
                    <input type="text" maxLength={255} value={editor.title} onChange={(e) => patchEditor({ title: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Instructions (shown to students)</label>
                    <textarea rows={2} value={editor.description} onChange={(e) => patchEditor({ description: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                  </div>

                  <div className="space-y-4">
                    {editor.questions.map((q, qi) => (
                      <div key={q.key} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-300">Question {qi + 1}</span>
                          <button type="button" onClick={() => removeQuestion(q.key)} className="text-xs font-bold text-red-500 hover:underline">Delete</button>
                        </div>
                        <textarea rows={2} value={q.question_text} onChange={(e) => patchQuestion(q.key, { question_text: e.target.value })} placeholder="Question text" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
                        <div className="mt-3 space-y-2">
                          {q.options.map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <input type="radio" name={`correct-${q.key}`} checked={q.correctIndex === oi} onChange={() => patchQuestion(q.key, { correctIndex: oi })} className="h-4 w-4 accent-emerald-600" title="Mark as correct answer" />
                              <input type="text" value={opt} onChange={(e) => setOption(q.key, oi, e.target.value)} placeholder={`Option ${String.fromCharCode(65 + oi)}`} className={`flex-1 rounded-lg border px-3 py-1.5 text-sm dark:bg-slate-900 dark:text-slate-100 ${q.correctIndex === oi ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-900/20' : 'border-slate-200 dark:border-slate-700'}`} />
                              {q.options.length > 2 && (
                                <button type="button" onClick={() => removeOption(q.key, oi)} className="text-slate-400 hover:text-red-500" title="Remove option" aria-label="Remove option">✕</button>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          {q.options.length < 6 ? (
                            <button type="button" onClick={() => addOption(q.key)} className="text-xs font-bold text-rose-600 hover:underline dark:text-rose-300">+ Add option</button>
                          ) : <span />}
                          <span className="text-[10px] text-slate-400">Select the radio next to the correct answer</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button type="button" onClick={addQuestion} className="w-full rounded-xl border-2 border-dashed border-slate-300 py-3 text-sm font-bold text-slate-500 hover:border-rose-400 hover:text-rose-600 dark:border-slate-600 dark:hover:border-rose-500">+ Add question</button>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
              {editor.step === 'source' ? (
                <>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={closeEditor}
                      disabled={generating}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={startManual}
                      disabled={generating}
                      className="text-xs font-bold text-slate-500 hover:text-rose-600 hover:underline disabled:opacity-50"
                    >
                      Skip AI — write questions manually
                    </button>
                  </div>
                  <button
                    type="button"
                    id="generate-quiz-btn"
                    onClick={handleGenerate}
                    disabled={generating || (!editor.moduleText.trim() && !editor.file)}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg disabled:opacity-50 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {generating ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Analyzing module & generating…
                      </>
                    ) : (
                      <>✨ Generate Quiz</>
                    )}
                  </button>
                </>
              ) : (
                <>
                  {!editor.id ? (
                    <button
                      type="button"
                      onClick={() => patchEditor({ step: 'source' })}
                      disabled={saving}
                      className="text-sm font-bold text-slate-500 hover:underline disabled:opacity-50"
                    >
                      ← Back to module
                    </button>
                  ) : <span />}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={closeEditor}
                      disabled={saving}
                      className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      id="save-quiz-btn"
                      onClick={handleSave}
                      disabled={saving}
                      className="rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg disabled:opacity-60 hover:from-red-500 hover:to-rose-500 transition-all"
                    >
                      {saving ? 'Saving…' : 'Save Quiz'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {proctorId && (
        <QuizProctorModal
          quizId={proctorId}
          onClose={() => setProctorId(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

function QuizProctorModal({ quizId, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [ending, setEnding] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getQuizProctor(quizId);
      if (res?.ok) { setData(res.data); setError(''); }
    } catch (err) {
      setError(quizErrorMessage(err, 'Could not load results.'));
    }
  }, [quizId]);

  useEffect(() => {
    load();
    const t = window.setInterval(load, 3000);
    return () => window.clearInterval(t);
  }, [load]);

  const isActive = data?.quiz?.status === 'active';

  const handleEnd = async () => {
    if (!window.confirm('End this quiz for everyone? Students still answering will be released and marked as timed out.')) return;
    setEnding(true);
    try {
      const res = await endQuiz(quizId);
      if (res?.ok === false) throw new Error(res.message);
      await load();
      onChanged?.();
    } catch (err) {
      setError(quizErrorMessage(err, 'Could not end the quiz.'));
    } finally {
      setEnding(false);
    }
  };

  const s = data?.summary;

  return typeof document !== 'undefined' ? createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-3 sm:p-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold text-slate-800 dark:text-slate-100">{data?.quiz?.title || 'Quiz Results'}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isActive ? '● Live — updates every 3 seconds' : data ? 'Quiz closed — final results' : 'Loading…'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

          {s && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {[
                ['Enrolled', s.enrolled, 'text-slate-700 dark:text-slate-100'],
                ['Not started', s.not_started, 'text-slate-500'],
                ['Answering', s.in_progress, 'text-amber-600'],
                ['Finished', s.finished, 'text-emerald-600'],
                ['Class average', s.average_percentage != null ? `${s.average_percentage}%` : '—', 'text-rose-600'],
              ].map(([label, value, cls]) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center dark:border-slate-700 dark:bg-slate-800/60">
                  <div className={`text-2xl font-extrabold ${cls}`}>{value}</div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</div>
                </div>
              ))}
            </div>
          )}

          {data && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.students.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No enrolled students.</td></tr>
                  )}
                  {data.students.map((st) => {
                    const a = ATTEMPT_STYLES[st.status] || ATTEMPT_STYLES.not_started;
                    const finished = st.status === 'completed' || st.status === 'timed_out';
                    return (
                      <tr key={st.student_id}>
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{st.full_name}</td>
                        <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${a.cls}`}>{a.label}</span></td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{finished ? `${st.score}/${st.total_points} (${st.percentage}%)` : '—'}</td>
                        <td className="px-4 py-3">
                          {finished ? (
                            <span className={`text-xs font-bold ${st.passed ? 'text-emerald-600' : 'text-red-600'}`}>{st.passed ? 'PASSED' : 'FAILED'}</span>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center border-t border-slate-200 px-6 py-4 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            Close
          </button>
          {isActive && (
            <button
              type="button"
              onClick={handleEnd}
              disabled={ending}
              className="rounded-xl bg-red-600 hover:bg-red-700 px-6 py-2.5 text-xs font-bold text-white shadow-md disabled:opacity-60 transition-colors"
            >
              {ending ? 'Ending…' : '⏹ End quiz now'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  ) : null;
}
