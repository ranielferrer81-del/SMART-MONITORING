import axios, { AxiosError } from 'axios';
import { getViteApiBaseUrl } from '../config/apiBase';

const API_BASE_URL = getViteApiBaseUrl();

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    if (config.headers && typeof config.headers.delete === 'function') {
      config.headers.delete('Content-Type');
    } else if (config.headers) {
      delete (config.headers as Record<string, unknown>)['Content-Type'];
    }
  }
  return config;
});

export type AuthenticatedUser = {
  id: number;
  email: string;
  fullName: string | null;
  role: string;
  studentNumber: string | null;
  course: string | null;
  section: string | null;
  profilePicture: string | null;
};

export type LoginResult = {
  ok: boolean;
  token: string;
  route: string;
  user: AuthenticatedUser;
};

export type LoginPayload = {
  email: string;
  password: string;
};

const normalizeUser = (payload: Record<string, unknown>): AuthenticatedUser => ({
  id: Number(payload.id),
  email: String(payload.email ?? ''),
  fullName: (payload.fullName ?? payload.full_name ?? null) as string | null,
  role: String(payload.role ?? 'student'),
  studentNumber: (payload.student_number ?? null) as string | null,
  course: (payload.course ?? null) as string | null,
  section: (payload.section ?? null) as string | null,
  profilePicture: (payload.profilePicture ?? payload.profile_picture ?? null) as string | null,
});

const extractErrorMessage = (error: unknown) => {
  if (typeof error === 'string') return error;
  if (error instanceof AxiosError) {
    return (
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'Unable to connect to the server'
    );
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong while talking to the server';
};

export async function loginRequest(payload: LoginPayload): Promise<LoginResult> {
  try {
    const { data } = await api.post('/api/login', payload);
    if (!data?.token) {
      throw new Error('The backend did not return an access token.');
    }

    const session: LoginResult = {
      ok: Boolean(data.ok),
      token: data.token,
      route: data.route ?? '/',
      user: normalizeUser(data.user ?? {}),
    };

    localStorage.setItem('token', session.token);
    localStorage.setItem('user_role', session.user.role);
    return session;
  } catch (error) {
    throw new Error(extractErrorMessage(error));
  }
}

export async function emailLogin(
  email: string,
  password: string
): Promise<{ ok: boolean; message: string; email: string; verification_code?: string | null; email_sent: boolean }> {
  try {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      throw new Error('Invalid email format. Please enter a valid email address.');
    }

    if (!password || password.trim().length === 0) {
      throw new Error('Password is required.');
    }

    const { data } = await api.post('/api/validate-email', {
      email: email.trim().toLowerCase(),
      password: password
    });

    if (!data?.ok) {
      throw new Error(data?.message || 'Failed to send verification code.');
    }

    return {
      ok: true,
      message: data.message || 'Verification code sent to your email.',
      email: data.email || email.trim().toLowerCase(),
      verification_code: data.verification_code || null,
      email_sent: data.email_sent === true,
    };
  } catch (error) {
    throw new Error(extractErrorMessage(error));
  }
}

export async function verifyEmailCode(email: string, code: string): Promise<LoginResult> {
  try {
    const { data } = await api.post('/api/verify-verification-code', {
      email: email.trim().toLowerCase(),
      code: code.trim(),
    });

    if (!data?.ok || !data?.token) {
      throw new Error(data?.message || 'Invalid verification code.');
    }

    const session: LoginResult = {
      ok: Boolean(data.ok),
      token: data.token,
      route: data.route ?? '/',
      user: normalizeUser(data.user ?? {}),
    };

    localStorage.setItem('token', session.token);
    localStorage.setItem('user_role', session.user.role);
    // Store credentials for display
    if (data.credentials) {
      localStorage.setItem('student_credentials', JSON.stringify(data.credentials));
    }
    return session;
  } catch (error) {
    throw new Error(extractErrorMessage(error));
  }
}

export async function resendVerificationCode(
  email: string
): Promise<{ ok: boolean; message: string; email_sent: boolean; verification_code?: string | null }> {
  try {
    const { data } = await api.post('/api/resend-verification-code', {
      email: email.trim().toLowerCase(),
    });

    if (!data?.ok) {
      throw new Error(data?.message || 'Failed to resend verification code.');
    }

    return {
      ok: true,
      message: data.message || 'Verification code has been resent.',
      email_sent: data.email_sent === true,
      verification_code: data.verification_code || null,
    };
  } catch (error) {
    throw new Error(extractErrorMessage(error));
  }
}

export async function fetchCurrentUser(): Promise<AuthenticatedUser> {
  try {
    const { data } = await api.get('/api/me');
    if (!data?.data) {
      throw new Error('Malformed response returned by the backend.');
    }
    return normalizeUser(data.data);
  } catch (error) {
    throw new Error(extractErrorMessage(error));
  }
}

export async function validatePin(pin: string): Promise<{ ok: boolean; message: string }> {
  try {
    const { data } = await api.post('/api/student/validate-pin', { pin });
    return {
      ok: Boolean(data.ok),
      message: data.message || 'PIN validated successfully',
    };
  } catch (error) {
    const message = extractErrorMessage(error);
    return {
      ok: false,
      message: message || 'Failed to validate PIN',
    };
  }
}


export async function fetchMonitoringStatus(): Promise<{ is_active: boolean; is_extension_connected: boolean }> {
  try {
    const { data } = await api.get('/api/browser-activity/status');
    return data;
  } catch (error) {
    console.error('Failed to fetch monitoring status', error);
    return { is_active: false, is_extension_connected: false };
  }
}

