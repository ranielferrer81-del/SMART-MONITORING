import { api } from './client';

export async function presentationStart() {
  const { data } = await api.post('/api/presentations/start');
  return data;
}

export async function presentationEnd(uuid) {
  const { data } = await api.post(`/api/presentations/${encodeURIComponent(uuid)}/end`);
  return data;
}

export async function presentationTeacherActive() {
  const { data } = await api.get('/api/presentations/teacher/active');
  return data;
}

export async function presentationStudentActive() {
  const { data } = await api.get('/api/presentations/student/active');
  return data;
}

export async function presentationJoin(uuid) {
  const { data } = await api.post(`/api/presentations/${encodeURIComponent(uuid)}/join`);
  return data;
}

export async function presentationViewers(uuid) {
  const { data } = await api.get(`/api/presentations/${encodeURIComponent(uuid)}/viewers`);
  return data;
}

export async function presentationPollSignals(uuid, since = 0) {
  const { data } = await api.get(`/api/presentations/${encodeURIComponent(uuid)}/signals`, {
    params: { since },
  });
  return data;
}

export async function presentationSendSignal(uuid, body) {
  const { data } = await api.post(`/api/presentations/${encodeURIComponent(uuid)}/signals`, body);
  return data;
}
