import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, Lock, ShieldAlert, XCircle } from 'lucide-react';
import { fetchQuizSession, submitQuiz } from '../api/quizzes';
import type { QuizResult, QuizSession } from '../api/quizzes';

type QuizLockOverlayProps = {
  quizId: number;
  title: string;
  subjectName?: string | null;
  /** True once the server stopped reporting this quiz as active (teacher ended it / already submitted). */
  serverEnded: boolean;
  /** Student pressed "Return to desktop" on the final screen. */
  onDismiss: () => void;
};

type Phase = 'loading' | 'error' | 'taking' | 'result' | 'ended';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

function errorText(err: unknown): string {
  const e = err as { response?: { data?: { message?: string } }; message?: string };
  return e?.response?.data?.message || e?.message || 'Something went wrong.';
}

export default function QuizLockOverlay({ quizId, title, subjectName, serverEnded, onDismiss }: QuizLockOverlayProps) {
  const storageKey = `quiz_answers_${quizId}`;

  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState('');
  const [session, setSession] = useState<QuizSession | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [visible, setVisible] = useState(false);

  const deadlineRef = useRef<number | null>(null);
  const submittedRef = useRef(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  const load = useCallback(async () => {
    setPhase('loading');
    setError('');
    try {
      const data = await fetchQuizSession(quizId);
      setSession(data);
      try {
        const saved = sessionStorage.getItem(storageKey);
        if (saved) setAnswers(JSON.parse(saved) as Record<number, string>);
      } catch {
        // ignore corrupt cache
      }
      if (data.remaining_seconds !== null) {
        deadlineRef.current = Date.now() + data.remaining_seconds * 1000;
        setSecondsLeft(data.remaining_seconds);
      } else {
        deadlineRef.current = null;
        setSecondsLeft(null);
      }
      setPhase('taking');
    } catch (err) {
      const status = (err as { response?: { status?: number; data?: { already_completed?: boolean } } })?.response;
      if (status?.status === 409 && status.data?.already_completed) {
        setPhase('ended');
        return;
      }
      setError(errorText(err));
      setPhase('error');
    }
  }, [quizId, storageKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const doSubmit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await submitQuiz(quizId, answersRef.current);
      sessionStorage.removeItem(storageKey);
      setResult(res);
      setConfirming(false);
      setPhase('result');
    } catch (err) {
      submittedRef.current = false;
      setSubmitError(errorText(err));
    } finally {
      setSubmitting(false);
    }
  }, [quizId, storageKey]);

  // Countdown based on a wall-clock deadline so it stays accurate if the renderer is throttled.
  useEffect(() => {
    if (phase !== 'taking' || deadlineRef.current === null) return undefined;
    const tick = () => {
      const left = Math.max(0, Math.ceil(((deadlineRef.current as number) - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) void doSubmit();
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [phase, doSubmit]);

  // Teacher ended the quiz (or it is otherwise no longer active on the server).
  useEffect(() => {
    if (!serverEnded) return;
    if (phase === 'taking' || phase === 'loading' || phase === 'error') {
      setConfirming(false);
      setPhase('ended');
    }
  }, [serverEnded, phase]);

  const selectAnswer = (questionId: number, option: string) => {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: option };
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // storage full / unavailable — answers still live in memory
      }
      return next;
    });
  };

  const questions = session?.questions ?? [];
  const current = questions[index];
  const answeredCount = useMemo(
    () => questions.filter((q) => answers[q.id] !== undefined).length,
    [questions, answers]
  );
  const unanswered = questions.length - answeredCount;

  const timerTone =
    secondsLeft === null
      ? 'text-white/80'
      : secondsLeft <= 60
        ? 'text-red-400 animate-pulse'
        : secondsLeft <= 300
          ? 'text-amber-300'
          : 'text-white/90';

  return (
    <div
      className="fixed inset-0 z-[45] flex flex-col overflow-hidden text-white select-none"
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.4s ease',
        background: 'radial-gradient(circle at 20% 0%, #3b0a14 0%, #0b1020 55%, #05070f 100%)',
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Header */}
      <header className="flex items-center justify-between gap-4 border-b border-white/10 bg-black/30 px-6 py-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-red-400/40 bg-red-900/40">
            <Lock className="h-5 w-5 text-red-300" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-red-300/90">
              <ShieldAlert className="h-3.5 w-3.5" /> Locked examination mode
            </div>
            <h1 className="truncate text-lg font-extrabold leading-tight">{title}</h1>
            {subjectName && <p className="truncate text-xs text-white/50">{subjectName}</p>}
          </div>
        </div>

        {phase === 'taking' && (
          <div className="flex shrink-0 items-center gap-5">
            <div className="text-right text-xs text-white/60">
              <div className="font-semibold text-white/80">{answeredCount}/{questions.length} answered</div>
              <div>Question {index + 1} of {questions.length}</div>
            </div>
            {secondsLeft !== null && (
              <div className={`flex items-center gap-2 rounded-xl border border-white/15 bg-black/40 px-4 py-2 font-mono text-2xl font-bold tracking-widest ${timerTone}`}>
                <Clock className="h-5 w-5" />
                {formatClock(secondsLeft)}
              </div>
            )}
          </div>
        )}
      </header>

      {/* Body */}
      <main className="relative flex min-h-0 flex-1 items-stretch">
        {phase === 'loading' && (
          <div className="m-auto text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-red-400" />
            <p className="text-white/70">Loading your quiz…</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="m-auto max-w-md text-center">
            <XCircle className="mx-auto mb-3 h-12 w-12 text-red-400" />
            <p className="mb-1 text-lg font-bold">Could not load the quiz</p>
            <p className="mb-5 text-sm text-white/60">{error}</p>
            <button type="button" onClick={() => void load()} className="rounded-xl bg-red-600 px-6 py-2.5 text-sm font-bold hover:bg-red-500">
              Try again
            </button>
            <p className="mt-4 text-xs text-white/40">Your screen stays locked until the quiz is finished or ended by your instructor.</p>
          </div>
        )}

        {phase === 'taking' && current && (
          <>
            {/* Question palette */}
            <aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-white/10 bg-black/20 p-4 md:block">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-white/50">Questions</p>
              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, i) => {
                  const done = answers[q.id] !== undefined;
                  const isCurrent = i === index;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setIndex(i)}
                      className={`h-9 rounded-lg text-sm font-bold transition ${isCurrent ? 'ring-2 ring-white' : ''} ${done ? 'bg-emerald-600/80 hover:bg-emerald-500' : 'bg-white/10 hover:bg-white/20'}`}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
              <div className="mt-5 space-y-1 text-[11px] text-white/50">
                <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-emerald-600/80" /> Answered</div>
                <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-white/10" /> Not answered</div>
              </div>
            </aside>

            {/* Question */}
            <section className="flex min-w-0 flex-1 flex-col overflow-y-auto px-6 py-8 md:px-12">
              <div className="mx-auto w-full max-w-3xl">
                {session?.quiz.description && index === 0 && (
                  <p className="mb-5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">{session.quiz.description}</p>
                )}
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-red-300">Question {index + 1}</p>
                <h2 className="mb-6 whitespace-pre-wrap text-2xl font-bold leading-snug">{current.question_text}</h2>

                <div className="space-y-3">
                  {current.options.map((opt, oi) => {
                    const selected = answers[current.id] === opt;
                    return (
                      <button
                        key={`${current.id}-${oi}`}
                        type="button"
                        onClick={() => selectAnswer(current.id, opt)}
                        className={`flex w-full items-center gap-4 rounded-xl border px-5 py-4 text-left transition ${selected
                          ? 'border-emerald-400 bg-emerald-600/25 shadow-[0_0_0_1px_rgba(52,211,153,0.6)]'
                          : 'border-white/15 bg-white/5 hover:border-white/40 hover:bg-white/10'}`}
                      >
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${selected ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/70'}`}>
                          {LETTERS[oi] ?? oi + 1}
                        </span>
                        <span className="text-base font-medium">{opt}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-8 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setIndex((i) => Math.max(0, i - 1))}
                    disabled={index === 0}
                    className="inline-flex items-center gap-1 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-bold hover:bg-white/10 disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </button>

                  {index < questions.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
                      className="inline-flex items-center gap-1 rounded-xl bg-white/15 px-5 py-2.5 text-sm font-bold hover:bg-white/25"
                    >
                      Next <ChevronRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirming(true)}
                      className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-extrabold hover:bg-emerald-500"
                    >
                      Submit quiz
                    </button>
                  )}
                </div>

                {index < questions.length - 1 && (
                  <div className="mt-6 text-center">
                    <button type="button" onClick={() => setConfirming(true)} className="text-xs font-semibold text-white/50 underline hover:text-white/80">
                      Finish and submit now
                    </button>
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {phase === 'result' && result && (
          <div className="m-auto max-w-md px-6 text-center">
            {result.passed ? (
              <CheckCircle2 className="mx-auto mb-3 h-16 w-16 text-emerald-400" />
            ) : (
              <XCircle className="mx-auto mb-3 h-16 w-16 text-red-400" />
            )}
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/50">
              {result.status === 'timed_out' ? 'Time expired — submitted' : 'Quiz submitted'}
            </p>
            <p className="mt-3 text-6xl font-extrabold">{Math.round(result.percentage)}%</p>
            <p className="mt-2 text-lg text-white/80">{result.score} / {result.total_points} points</p>
            <p className={`mt-3 inline-block rounded-full px-4 py-1 text-sm font-extrabold ${result.passed ? 'bg-emerald-600/30 text-emerald-300' : 'bg-red-600/30 text-red-300'}`}>
              {result.passed ? 'PASSED' : 'DID NOT PASS'} · passing {result.passing_percentage}%
            </p>
            <div>
              <button type="button" onClick={onDismiss} className="mt-8 rounded-xl bg-white px-8 py-3 text-sm font-extrabold text-slate-900 hover:bg-white/90">
                Return to desktop
              </button>
            </div>
          </div>
        )}

        {phase === 'ended' && (
          <div className="m-auto max-w-md px-6 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-14 w-14 text-white/60" />
            <p className="text-xl font-bold">This quiz has ended</p>
            <p className="mt-2 text-sm text-white/60">Your instructor closed the quiz, or you already completed it. You can return to your desktop.</p>
            <button type="button" onClick={onDismiss} className="mt-8 rounded-xl bg-white px-8 py-3 text-sm font-extrabold text-slate-900 hover:bg-white/90">
              Return to desktop
            </button>
          </div>
        )}
      </main>

      {/* Submit confirmation */}
      {confirming && phase === 'taking' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-slate-900 p-6 text-center shadow-2xl">
            <h3 className="text-xl font-extrabold">Submit your quiz?</h3>
            <p className="mt-2 text-sm text-white/70">
              {unanswered > 0
                ? `You still have ${unanswered} unanswered question${unanswered !== 1 ? 's' : ''}. They will be marked wrong.`
                : 'You answered every question.'}
            </p>
            <p className="mt-1 text-xs text-white/40">You cannot change your answers after submitting.</p>
            {submitError && <p className="mt-3 rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-200">{submitError}</p>}
            <div className="mt-6 flex justify-center gap-3">
              <button type="button" disabled={submitting} onClick={() => setConfirming(false)} className="rounded-xl border border-white/20 px-5 py-2.5 text-sm font-bold hover:bg-white/10 disabled:opacity-50">
                Keep working
              </button>
              <button type="button" disabled={submitting} onClick={() => void doSubmit()} className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-extrabold hover:bg-emerald-500 disabled:opacity-60">
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-submit failure while the timer expired (confirm dialog not open) */}
      {!confirming && submitError && phase === 'taking' && (
        <div className="absolute inset-x-0 bottom-6 z-10 mx-auto w-full max-w-md rounded-xl border border-red-400/40 bg-red-950/90 px-4 py-3 text-center text-sm">
          <p className="mb-2 text-red-200">{submitError}</p>
          <button type="button" onClick={() => void doSubmit()} className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-bold hover:bg-red-500">
            Retry submit
          </button>
        </div>
      )}
    </div>
  );
}
