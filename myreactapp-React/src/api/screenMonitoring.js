import axios from 'axios';
import { getApiBase } from '../config/apiBase';

const getAuthToken = () => localStorage.getItem('token');

export async function getScreenMonitorGrid(filters = {}) {
  try {
    const token = getAuthToken();
    const params = new URLSearchParams();
    if (filters.laboratory_room) {
      params.set('laboratory_room', filters.laboratory_room);
    }
    const qs = params.toString();
    const url = `${getApiBase()}/api/screen-monitor/grid${qs ? `?${qs}` : ''}`;
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    return { ok: true, data: response.data };
  } catch (error) {
    return {
      ok: false,
      error: error.response?.data?.message || error.response?.data?.error || error.message,
    };
  }
}

/**
 * Fetch frame as blob URL (remember to URL.revokeObjectURL when done).
 */
export async function fetchScreenMonitorFrameBlobUrl(studentId) {
  const token = getAuthToken();
  const url = `${getApiBase()}/api/screen-monitor/student/${studentId}/frame`;
  const response = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'image/*',
    },
    responseType: 'blob',
  });
  return URL.createObjectURL(response.data);
}
