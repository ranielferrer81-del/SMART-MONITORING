import { api } from './client';

export async function presentationJoin(uuid: string) {
  const { data } = await api.post<{ ok: boolean; teacher_user_id?: number; message?: string }>(
    `/api/presentations/${encodeURIComponent(uuid)}/join`
  );
  return data;
}

export async function presentationPollSignals(uuid: string, since = 0) {
  const { data } = await api.get<{
    ok: boolean;
    session_status?: string;
    signals?: Array<{
      id: number;
      sender_user_id: number | null;
      recipient_user_id: number | null;
      message_type: 'offer' | 'answer' | 'iceCandidate' | 'hangup';
      payload: any;
    }>;
  }>(`/api/presentations/${encodeURIComponent(uuid)}/signals`, {
    params: { since },
  });
  return data;
}

export async function presentationSendSignal(uuid: string, body: Record<string, unknown>) {
  const { data } = await api.post<{ ok: boolean }>(
    `/api/presentations/${encodeURIComponent(uuid)}/signals`,
    body
  );
  return data;
}
