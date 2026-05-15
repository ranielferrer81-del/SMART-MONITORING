import axios from 'axios';
import { getApiBase } from '../config/apiBase';

/** Laravel 422 validation: surface first field message instead of generic axios text */
function formatAxiosValidationError(error) {
  const d = error.response?.data;
  if (d?.errors && typeof d.errors === 'object') {
    const first = Object.values(d.errors)
      .flat()
      .find((m) => typeof m === 'string' && m.length);
    if (first) return first;
  }
  if (d?.message) return d.message;
  if (error.message) return error.message;
  return 'Request failed';
}

/** Laravel login: read API message (unknown email uses 422 + message; 404 usually means wrong URL). */
function extractLoginErrorMessage(error) {
  const status = error.response?.status;
  const d = error.response?.data;
  let apiMsg = '';
  if (d && typeof d === 'object' && !Array.isArray(d)) {
    apiMsg = String(d.message ?? d.error ?? '').trim();
  } else if (typeof d === 'string') {
    const t = d.trim();
    if (t.startsWith('{')) {
      try {
        const p = JSON.parse(t);
        apiMsg = String(p.message ?? '').trim();
      } catch {
        /* not JSON */
      }
    }
  }
  if (apiMsg) return apiMsg;
  if (status === 404) {
    return 'Cannot reach the login API (404). Confirm the Laravel app exposes POST /api/login (no extra /api in REACT_APP_API_BASE).';
  }
  if (status === 401) return 'Incorrect password';
  if (status === 422) return formatAxiosValidationError(error);
  return String(error.message || 'Login failed');
}

export const api = axios.create({
  headers: { 'Content-Type': 'application/json' },
  timeout: 90000, // Render free instances can cold-start in ~50s; keep enough buffer
});

// Resolve base URL per request so runtime patches (e.g. patch-api-base.js before serve) apply.
api.interceptors.request.use((config) => {
  config.baseURL = getApiBase();
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Default Content-Type is application/json — that breaks multipart uploads: Laravel
  // never sees profile_picture, validation fails with 422 "required". Browser must set
  // multipart/form-data with boundary for FormData.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    if (config.headers && typeof config.headers.delete === 'function') {
      config.headers.delete('Content-Type');
    } else {
      delete config.headers['Content-Type'];
    }
  }
  return config;
});

export async function loginRequest(email, password) {
  try {
    const res = await api.post('/api/login', { email, password });
    const contentType = String(res.headers?.['content-type'] || '');
    const responseData = res.data;
    const looksLikeHtml =
      typeof responseData === 'string' &&
      /<!doctype html>|<html[\s>]/i.test(responseData);
    const missingAuthPayload =
      !responseData ||
      typeof responseData !== 'object' ||
      !responseData.token ||
      !responseData.user;

    if (looksLikeHtml || missingAuthPayload) {
      console.log('Login invalid payload:', {
        contentType,
        preview:
          typeof responseData === 'string'
            ? responseData.slice(0, 120)
            : responseData,
      });
      return {
        ok: false,
        error:
          'Login endpoint returned invalid response. Check REACT_APP_API_BASE, api-config.js, and backend /api/login route.',
      };
    }

    console.log('Login success:', responseData);
    return { ok: true, data: responseData };
  } catch (error) {
    const status = error.response?.status;
    const d = error.response?.data;
    const apiMessage = extractLoginErrorMessage(error);
    const baseURL = error.config?.baseURL || '';
    const path = error.config?.url || '';
    const fullUrl = baseURL && path ? `${String(baseURL).replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}` : path;
    console.log('Login error:', {
      status,
      apiMessage,
      axiosMessage: error.message,
      fullUrl,
      data: d,
    });
    return { ok: false, error: apiMessage, raw: d, status };
  }
}

export async function createAccount(payload) {
  // payload: { role, full_name, email, password }
  const res = await api.post('/api/admin/accounts', payload);
  return res.data;
}

export async function fetchTeachers() {
  try {
    const res = await api.get('/api/admin/accounts/teachers');
    console.log('fetchTeachers raw response:', res);
    console.log('fetchTeachers response data:', res.data);
    return res.data; // Returns { ok: true, data: [...] }
  } catch (error) {
    console.error('fetchTeachers error:', error);
    return { ok: false, data: [], error: error.message };
  }
}

export async function fetchAllStudents() {
  try {
    const res = await api.get('/api/admin/accounts/students');
    return res.data;
  } catch (error) {
    console.error('fetchAllStudents error:', error);
    return { ok: false, data: [], error: error.message };
  }
}

// Teacher-specific endpoint to fetch all students
export async function fetchAllStudentsForTeacher() {
  try {
    const res = await api.get('/api/teacher/students');
    return res.data;
  } catch (error) {
    console.error('fetchAllStudentsForTeacher error:', error);
    return { ok: false, data: [], error: error.message };
  }
}

export async function fetchStudentsByCourse(course) {
  const maxRetries = 2;
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await api.get(`/api/admin/accounts/students/${course}`, {
        timeout: 30000 // Increase timeout to 30 seconds
      });
      if (attempt > 0) {
        console.log(`✅ fetchStudentsByCourse(${course}) succeeded on retry ${attempt}`);
      }
      return res.data;
    } catch (error) {
      lastError = error;
      console.error(`❌ fetchStudentsByCourse(${course}) attempt ${attempt + 1}/${maxRetries + 1} failed:`, error.message);

      // Only retry on network errors or timeouts, not on 4xx/5xx errors
      if (error.response) {
        // Server responded with error status - don't retry
        return { ok: false, data: [], error: error.response.data?.message || error.message };
      }

      // Network error or timeout - wait before retry
      if (attempt < maxRetries) {
        const delay = 1000 * (attempt + 1); // 1s, 2s
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed
  console.error(`⛔ fetchStudentsByCourse(${course}) failed after ${maxRetries + 1} attempts`);
  return { ok: false, data: [], error: lastError?.message || 'Request failed' };
}

// Teacher-scoped fetch (uses teacher-only endpoint)
export async function fetchTeacherStudentsByCourse(course) {
  try {
    const res = await api.get(`/api/teacher/students/${course}`);
    return res.data;
  } catch (error) {
    console.error(`fetchTeacherStudentsByCourse(${course}) error:`, error);
    return { ok: false, data: [], error: error.message };
  }
}

export async function updateAccount(userId, payload) {
  const res = await api.patch(`/api/admin/accounts/${userId}`, payload);
  return res.data;
}

export async function deleteAccount(userId) {
  const res = await api.delete(`/api/admin/accounts/${userId}`);
  return res.data;
}

// Subjects API
export async function listSubjects(course) {
  const maxRetries = 2;
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await api.get('/api/subjects', {
        params: { course },
        timeout: 30000 // Increase timeout to 30 seconds
      });
      console.log('listSubjects raw response:', res.data);
      if (attempt > 0) {
        console.log(`✅ listSubjects succeeded on retry ${attempt}`);
      }
      return res.data;
    } catch (error) {
      lastError = error;
      console.error(`❌ listSubjects attempt ${attempt + 1}/${maxRetries + 1} failed:`, error.message);

      // Only retry on network errors or timeouts, not on 4xx/5xx errors
      if (error.response) {
        // Server responded with error status - don't retry
        return { ok: false, data: [], error: error.response.data?.message || error.message };
      }

      // Network error or timeout - wait before retry
      if (attempt < maxRetries) {
        const delay = 1000 * (attempt + 1); // 1s, 2s
        console.log(`⏳ Retrying listSubjects in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed
  console.error(`⛔ listSubjects failed after ${maxRetries + 1} attempts`);
  return { ok: false, data: [], error: lastError?.message || 'Request failed' };
}

export async function createSubject(payload) {
  const res = await api.post('/api/subjects', payload);
  return res.data;
}

export async function saveSubjectSchedules(subjectId, schedules) {
  try {
    const res = await api.put(`/api/subjects/${subjectId}/schedules`, { schedules });
    return { ok: true, data: res.data };
  } catch (error) {
    return {
      ok: false,
      error: error.response?.data?.message || 'Failed to save subject schedule',
      raw: error.response?.data,
    };
  }
}

export async function deleteSubject(id) {
  const res = await api.delete(`/api/subjects/${id}`);
  return res.data;
}

export async function getSubjectEnrolledStudents(subjectId) {
  try {
    const res = await api.get(`/api/subjects/${subjectId}`);
    return res.data;
  } catch (error) {
    console.error(`getSubjectEnrolledStudents(${subjectId}) error:`, error);
    return { ok: false, data: [], error: error.message };
  }
}

export async function enrollStudentToSubject(subjectId, studentId) {
  const res = await api.post(`/api/subjects/${subjectId}/enroll`, { student_id: studentId });
  return res.data;
}

export async function enrollAllStudentsToSubject(subjectId, studentIds) {
  const res = await api.post(`/api/subjects/${subjectId}/enroll-all`, { student_ids: studentIds });
  return res.data;
}

export async function unenrollStudentFromSubject(subjectId, studentId) {
  const res = await api.delete(`/api/subjects/${subjectId}/unenroll/${studentId}`);
  return res.data;
}

// Manual attendance update (present / late / absent) for a student in a subject
export async function markStudentAttendance(subjectId, studentId, status, reason = null) {
  const res = await api.post(`/api/subjects/${subjectId}/attendance`, {
    student_id: studentId,
    status,
    reason,
  });
  return res.data;
}

// Get attendance history for a student in a subject (for teacher view)
export async function getStudentAttendanceHistory(subjectId, studentId) {
  try {
    const res = await api.get(`/api/subjects/${subjectId}/students/${studentId}/attendance`);
    return { ok: true, data: res.data };
  } catch (error) {
    const message = error.response?.data?.message || 'Failed to fetch attendance history';
    return { ok: false, error: message, raw: error.response?.data };
  }
}

// Update a specific attendance record
export async function updateAttendanceRecord(subjectId, studentId, recordId, status, reason = null) {
  try {
    const res = await api.patch(`/api/subjects/${subjectId}/students/${studentId}/attendance/${recordId}`, {
      status,
      reason,
    });
    return { ok: true, data: res.data };
  } catch (error) {
    const message = error.response?.data?.message || 'Failed to update attendance record';
    return { ok: false, error: message, raw: error.response?.data };
  }
}

// Current authenticated user
export async function fetchMe() {
  try {
    const res = await api.get('/api/me');
    return res.data;
  } catch (error) {
    console.error('fetchMe error:', error);
    return { ok: false, data: null, error: error.message };
  }
}

// Long timeout: large multipart + server base64 + DB (Railway can be slow on cold start)
const PROFILE_UPLOAD_TIMEOUT_MS = 120000;

// Student profile picture
export async function uploadProfilePicture(file) {
  const formData = new FormData();
  formData.append('profile_picture', file);
  try {
    const res = await api.post('/api/student/profile-picture', formData, {
      timeout: PROFILE_UPLOAD_TIMEOUT_MS,
    });
    return res.data;
  } catch (error) {
    throw new Error(formatAxiosValidationError(error));
  }
}

export async function deleteProfilePicture() {
  const res = await api.delete('/api/student/profile-picture');
  return res.data;
}

// Teacher profile picture
export async function uploadTeacherProfilePicture(file) {
  const formData = new FormData();
  formData.append('profile_picture', file);
  try {
    const res = await api.post('/api/teacher/profile-picture', formData, {
      timeout: PROFILE_UPLOAD_TIMEOUT_MS,
    });
    return res.data;
  } catch (error) {
    throw new Error(formatAxiosValidationError(error));
  }
}

export async function deleteTeacherProfilePicture() {
  const res = await api.delete('/api/teacher/profile-picture');
  return res.data;
}

// Student enrolled subjects and attendance
export async function getStudentEnrolledSubjects() {
  try {
    const res = await api.get('/api/student/subjects');
    return { ok: true, data: res.data };
  } catch (error) {
    const message = error.response?.data?.message || 'Failed to fetch enrolled subjects';
    return { ok: false, error: message, raw: error.response?.data };
  }
}

export async function getStudentAttendance(subjectId) {
  try {
    const res = await api.get(`/api/student/subjects/${subjectId}/attendance`);
    return { ok: true, data: res.data };
  } catch (error) {
    const message = error.response?.data?.message || 'Failed to fetch attendance';
    return { ok: false, error: message, raw: error.response?.data };
  }
}

export async function getStudentOpenSessions() {
  try {
    const res = await api.get('/api/student/open-sessions');
    return { ok: true, data: res.data };
  } catch (error) {
    return {
      ok: false,
      error: error.response?.data?.message || 'Failed to fetch open sessions',
      raw: error.response?.data,
    };
  }
}

export async function checkInStudentSubject(subjectId, pin) {
  try {
    const res = await api.post(`/api/student/subjects/${subjectId}/check-in`, { pin });
    return { ok: true, data: res.data };
  } catch (error) {
    return {
      ok: false,
      error: error.response?.data?.message || 'Check-in failed',
      raw: error.response?.data,
    };
  }
}

// Student PIN
export async function updateStudentPin(pin) {
  try {
    const res = await api.post('/api/student/pin', { pin });
    return { ok: true, data: res.data };
  } catch (error) {
    const message = error.response?.data?.message || 'Failed to update PIN';
    return { ok: false, error: message, raw: error.response?.data };
  }
}

// Update student profile (name, password)
export async function updateStudentProfile(data) {
  try {
    const res = await api.patch('/api/student/profile', data);
    return { ok: true, data: res.data };
  } catch (error) {
    const message = formatAxiosValidationError(error);
    return { ok: false, error: message, raw: error.response?.data };
  }
}

export async function updateTeacherProfile(data) {
  try {
    const res = await api.patch('/api/teacher/profile', data);
    return { ok: true, data: res.data };
  } catch (error) {
    const message = formatAxiosValidationError(error);
    return { ok: false, error: message, raw: error.response?.data };
  }
}

export async function updateAdminProfile(data) {
  try {
    const res = await api.patch('/api/admin/profile', data);
    return { ok: true, data: res.data };
  } catch (error) {
    const message = formatAxiosValidationError(error);
    return { ok: false, error: message, raw: error.response?.data };
  }
}
