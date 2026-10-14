import { api } from './client';

export type QuizQuestion = {
  id: number;
  question_text: string;
  options: string[];
  points: number;
  order_index: number;
};

export type QuizSession = {
  quiz: {
    id: number;
    title: string;
    description: string | null;
    time_limit_minutes: number;
    passing_percentage: number;
  };
  /** Seconds left on the server clock, or null when the quiz is untimed. */
  remaining_seconds: number | null;
  questions: QuizQuestion[];
};

export type QuizResult = {
  status: 'completed' | 'timed_out' | 'in_progress';
  score: number;
  total_points: number;
  percentage: number;
  passed: boolean;
  passing_percentage: number;
};

/** Loads (and begins) the student's attempt. Throws an axios error on 404/409. */
export async function fetchQuizSession(quizId: number): Promise<QuizSession> {
  const { data } = await api.get<{ ok: boolean; data: QuizSession }>(`/api/quizzes/${quizId}/student-view`);
  return data.data;
}

export async function submitQuiz(quizId: number, answers: Record<number, string>): Promise<QuizResult> {
  const { data } = await api.post<{ ok: boolean; data: QuizResult }>(`/api/quizzes/${quizId}/submit`, { answers });
  return data.data;
}
