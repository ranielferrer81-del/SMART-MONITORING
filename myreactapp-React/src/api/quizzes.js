import { api } from './client';

export function quizErrorMessage(err, fallback = 'Something went wrong.') {
  const status = err?.response?.status;
  if (status === 413) {
    return 'The uploaded file exceeds the PHP upload limit. Please restart your Laravel server to apply the updated 64MB limit, or copy and paste the lesson text directly into the box.';
  }
  const data = err?.response?.data;
  if (data?.message && typeof data.message === 'string') return data.message;
  if (data?.errors && typeof data.errors === 'object') {
    const first = Object.values(data.errors).flat()[0];
    if (first) return String(first);
  }
  if (err?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  return err?.message || fallback;
}

export async function listQuizzes(subjectId = null) {
  const { data } = await api.get('/api/quizzes', { params: subjectId ? { subject_id: subjectId } : {} });
  return data;
}

export async function getQuiz(id) {
  const { data } = await api.get(`/api/quizzes/${id}`);
  return data;
}

/**
 * Sends module text and/or file to the backend, which returns generated questions for review.
 * @param {{moduleText?: string, file?: File|null, questionCount?: number, difficulty?: string, title?: string}} opts
 */
export async function generateQuizFromModule({ moduleText = '', file = null, questionCount = 10, difficulty = 'medium', title = '' }) {
  const form = new FormData();
  if (moduleText) form.append('module_text', moduleText);
  if (file) form.append('module_file', file);
  form.append('question_count', String(questionCount));
  form.append('difficulty', difficulty);
  if (title) form.append('title', title);
  const { data } = await api.post('/api/quizzes/generate-ai', form, { timeout: 120000 });
  return data;
}

export async function createQuiz(payload) {
  const { data } = await api.post('/api/quizzes', payload);
  return data;
}

export async function updateQuiz(id, payload) {
  const { data } = await api.put(`/api/quizzes/${id}`, payload);
  return data;
}

export async function deleteQuiz(id) {
  const { data } = await api.delete(`/api/quizzes/${id}`);
  return data;
}

export async function startQuiz(id) {
  const { data } = await api.post(`/api/quizzes/${id}/start`);
  return data;
}

export async function endQuiz(id) {
  const { data } = await api.post(`/api/quizzes/${id}/end`);
  return data;
}

export async function getQuizProctor(id) {
  const { data } = await api.get(`/api/quizzes/${id}/proctor`);
  return data;
}
