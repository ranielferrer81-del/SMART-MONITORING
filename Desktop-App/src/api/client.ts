import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import { getApiBaseUrl, initApiBaseUrl } from '../config/apiBase';
import { startOtpTrace, type OtpEndpoint, type OtpTraceHandle } from '../utils/otpTelemetry';

export { initApiBaseUrl };

/** Default for most API calls */
const DEFAULT_TIMEOUT_MS = 15000;
/**
 * validate-email / resend send mail on the server before responding; Brevo/SMTP + cold start
 * often needs more than the default window. Backend OTP wall-clock budget is configurable
 * (config('app.verification_mail_time_budget_seconds')); 120s gives a comfortable margin even
 * on slow demo Wi-Fi.
 */
const EMAIL_AUTH_TIMEOUT_MS = 120_000;
/**
 * Resend goes through the same provider chain as the initial send (Brevo/Resend/SMTP). When
 * the user is on a slow/changing Wi-Fi, the response can take just as long. Keep this >= the
 * backend budget so we never abort a request that is actually still working.
 */
const RESEND_VERIFICATION_TIMEOUT_MS = 120_000;
/** Cold Railway + DB: allow verify to finish without default 15s axios abort. */
const VERIFY_VERIFICATION_CODE_TIMEOUT_MS = 60_000;
const COLD_START_WARMUP_TIMEOUT_MS = 120_000;
/**
 * Retry policy for OTP send/resend/verify. We retry exactly once on transient failures
 * (timeout, lost connection, gateway 5xx, 408, 429). One retry is enough to recover from a
 * brief Wi-Fi flap without making the server send two real emails — the backend reuses an
 * unused, still-fresh code within a 45s window so a retry is safe.
 */
const EMAIL_AUTH_MAX_ATTEMPTS = 2;
const EMAIL_AUTH_RETRY_DELAY_MS = 1_500;

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: DEFAULT_TIMEOUT_MS,
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

type EmailAuthErrorContext = 'email_login' | 'resend' | 'verify_code' | 'default';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const isOnline = (): boolean => {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
};

/**
 * Errors that are safe to retry: transient TCP/TLS issues caused by Wi-Fi flapping or
 * the upstream provider hiccupping. We deliberately do NOT retry 4xx (other than 408/429)
 * because those are real client-side rejections (bad code, wrong password, 403).
 */
const isRetryableEmailAuthError = (error: unknown): boolean => {
  if (!(error instanceof AxiosError)) return false;
  if (error.code === 'ECONNABORTED') return true;
  if (error.code === 'ERR_NETWORK') return true;
  if (error.code === 'ETIMEDOUT') return true;
  if (error.code === 'ECONNRESET') return true;
  const status = error.response?.status;
  if (typeof status !== 'number') {
    // No HTTP response = the request never made it back. Treat as retryable.
    return true;
  }
  return status === 408 || status === 429 || status >= 500;
};

type AxiosResponseLike<T> = { data: T };

/**
 * Wrapper around `api.request` that:
 *   1. Short-circuits with a clear message if the OS already reports offline.
 *   2. Retries once on transient errors (Wi-Fi flap, gateway 5xx, etc.).
 *   3. Emits OTP trace events so we can correlate with backend logs.
 *
 * The backend's OTP code-reuse window makes a retry idempotent for the user: if the
 * first request actually succeeded after we gave up on it, the second request will
 * receive the same code and the email may already be on its way.
 */
async function emailAuthRequest<T>(
  endpoint: OtpEndpoint,
  config: AxiosRequestConfig
): Promise<AxiosResponseLike<T>> {
  if (!isOnline()) {
    const offlineTrace = startOtpTrace(endpoint, 1);
    offlineTrace.finish('offline', { errorCode: 'OFFLINE' });
    throw new AxiosError(
      'You appear to be offline. Reconnect to Wi-Fi and try again.',
      'ERR_NETWORK'
    );
  }

  let lastError: unknown;
  let trace: OtpTraceHandle | undefined;
  for (let attempt = 1; attempt <= EMAIL_AUTH_MAX_ATTEMPTS; attempt += 1) {
    trace = startOtpTrace(endpoint, attempt, trace?.id);
    const tracedConfig: AxiosRequestConfig = {
      ...config,
      headers: {
        ...(config.headers ?? {}),
        // Sent so backend Log entries can be correlated with the desktop ring-buffer
        // when something fails on a different Wi-Fi.
        'X-OTP-Trace-Id': `${trace.id}#${attempt}`,
      },
    };
    try {
      const response = await api.request<T>(tracedConfig);
      trace.finish('ok', { httpStatus: response.status });
      return { data: response.data };
    } catch (error) {
      lastError = error;
      const httpStatus =
        error instanceof AxiosError ? error.response?.status : undefined;
      const errorCode =
        error instanceof AxiosError ? error.code ?? undefined : undefined;
      const errorMessage = error instanceof Error ? error.message : String(error);

      const canRetry =
        attempt < EMAIL_AUTH_MAX_ATTEMPTS && isRetryableEmailAuthError(error);
      trace.finish(canRetry ? 'retry' : 'fail', {
        errorCode,
        errorMessage,
        httpStatus,
      });

      if (!canRetry) break;
      await sleep(EMAIL_AUTH_RETRY_DELAY_MS);
    }
  }

  throw lastError;
}

const extractErrorMessage = (error: unknown, context: EmailAuthErrorContext = 'default') => {
  if (typeof error === 'string') return error;
  if (error instanceof AxiosError) {
    if (error.code === 'ERR_NETWORK') {
      if (context === 'resend' || context === 'email_login') {
        return 'Connection lost while sending the code. This often happens right after switching Wi-Fi. Reconnect and try again.';
      }
      if (context === 'verify_code') {
        return 'Connection lost while checking your code. Reconnect to Wi-Fi and try again.';
      }
      return 'Network connection lost. Reconnect and try again.';
    }
    if (error.code === 'ECONNABORTED') {
      if (context === 'resend') {
        return 'Resend is taking longer than expected. If you receive the code, just enter it. Otherwise try again in a moment.';
      }
      if (context === 'email_login') {
        return 'Login request timed out while sending verification code. Please try again in a few seconds.';
      }
      if (context === 'verify_code') {
        return 'Verification timed out. Check your connection and try again.';
      }
      return 'Request timed out. Please try again in a few seconds.';
    }
    const status = error.response?.status;
    const data = error.response?.data;
    const reqUrl = `${error.config?.baseURL ?? ''}${error.config?.url ?? ''}`;
    const json404Message =
      status === 404 &&
      data &&
      typeof data === 'object' &&
      typeof (data as { message?: unknown }).message === 'string'
        ? String((data as { message: string }).message)
        : null;
    // Laravel returns 4xx JSON with message for "email not found" / missing profile — do not blame VITE_API_BASE_URL.
    if (json404Message) {
      return json404Message;
    }
    if (
      status === 404 &&
      (reqUrl.includes('validate-email') ||
        reqUrl.includes('verify-verification') ||
        reqUrl.includes('resend-verification'))
    ) {
      return (
        '404: Login API not found. Use the Railway Laravel backend base URL in VITE_API_BASE_URL (the same service where GET /health returns JSON with a "php" field), not the React website URL. ' +
        'Origin only, no /api suffix (e.g. https://your-api.up.railway.app), then rebuild the Desktop app.'
      );
    }
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
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      throw new Error('Invalid email format. Please enter a valid email address.');
    }

    if (!password || password.trim().length === 0) {
      throw new Error('Password is required.');
    }

    void warmupBackend();

    const { data } = await emailAuthRequest<{
      ok?: boolean;
      message?: string;
      email?: string;
      verification_code?: string | null;
      email_sent?: boolean;
    }>('validate-email', {
      method: 'POST',
      url: '/api/validate-email',
      data: {
        email: email.trim().toLowerCase(),
        password: password,
      },
      timeout: EMAIL_AUTH_TIMEOUT_MS,
    });

    if (!data?.ok) {
      throw new Error(data?.message || 'Failed to send verification code.');
    }

    const emailSent = parseEmailSent(data.email_sent);

    return {
      ok: true,
      message:
        data.message ||
        (emailSent
          ? 'Verification code sent to your email.'
          : 'Use the code on the next screen to finish signing in.'),
      email: data.email || email.trim().toLowerCase(),
      verification_code: data.verification_code || null,
      email_sent: emailSent,
    };
  } catch (error) {
    throw new Error(extractErrorMessage(error, 'email_login'));
  }
}

export async function warmupBackend(): Promise<void> {
  try {
    await api.get('/health', { timeout: COLD_START_WARMUP_TIMEOUT_MS });
  } catch {
    // Wake attempt only — ignore outcome.
  }
}

export type BackendCheckResult = { ok: true } | { ok: false; message: string };

/** Background health probe on login screen — fail fast so UI is not blocked for a minute. */
const BACKEND_HEALTH_CHECK_TIMEOUT_MS = 20_000;

const parseEmailSent = (value: unknown): boolean =>
  value === true || value === 1 || value === '1' || value === 'true';

export async function verifyLaravelBackend(): Promise<BackendCheckResult> {
  try {
    const { data } = await api.get('/health', { timeout: BACKEND_HEALTH_CHECK_TIMEOUT_MS });
    const isJsonHealthOk =
      data &&
      typeof data === 'object' &&
      (data as { status?: string }).status === 'ok';

    const isLaravelUpPage =
      typeof data === 'string' &&
      /application up|http request received/i.test(data);

    if (isJsonHealthOk || isLaravelUpPage) {
      return { ok: true };
    }
    return {
      ok: false,
      message:
        'This URL does not look like the Laravel API (GET /health should return JSON with status and php). Set VITE_API_BASE_URL to your Railway backend service, not the React website.',
    };
  } catch (e) {
    return {
      ok: false,
      message: `Cannot reach the Laravel API: ${extractErrorMessage(e)}. Check VITE_API_BASE_URL and rebuild.`,
    };
  }
}

export async function verifyEmailCode(email: string, code: string): Promise<LoginResult> {
  try {
    const { data } = await emailAuthRequest<{
      ok?: boolean;
      token?: string;
      route?: string;
      user?: Record<string, unknown>;
      credentials?: unknown;
      message?: string;
    }>('verify-verification-code', {
      method: 'POST',
      url: '/api/verify-verification-code',
      data: {
        email: email.trim().toLowerCase(),
        code: code.trim(),
      },
      timeout: VERIFY_VERIFICATION_CODE_TIMEOUT_MS,
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
    throw new Error(extractErrorMessage(error, 'verify_code'));
  }
}

export async function resendVerificationCode(
  email: string
): Promise<{ ok: boolean; message: string; email_sent: boolean; verification_code?: string | null }> {
  try {
    void warmupBackend();

    const { data } = await emailAuthRequest<{
      ok?: boolean;
      message?: string;
      email_sent?: boolean;
      verification_code?: string | null;
    }>('resend-verification-code', {
      method: 'POST',
      url: '/api/resend-verification-code',
      data: {
        email: email.trim().toLowerCase(),
      },
      timeout: RESEND_VERIFICATION_TIMEOUT_MS,
    });

    if (!data?.ok) {
      throw new Error(data?.message || 'Failed to resend verification code.');
    }

    const emailSent = parseEmailSent(data.email_sent);

    return {
      ok: true,
      message:
        data.message ||
        (emailSent
          ? 'Verification code has been resent to your email.'
          : 'Use the code shown on screen to continue.'),
      email_sent: emailSent,
      verification_code: data.verification_code || null,
    };
  } catch (error) {
    throw new Error(extractErrorMessage(error, 'resend'));
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

