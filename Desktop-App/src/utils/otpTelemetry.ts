/**
 * Lightweight OTP trace utility.
 *
 * Goal: when OTP send/resend/verify fails on a panel/demo Wi-Fi, we want to know
 * exactly *why* without making the user describe it. Each call gets a short
 * trace id and we record:
 *   - endpoint, attempt number
 *   - start / end timestamps and duration
 *   - navigator.onLine state at start and at end
 *   - high-level outcome ('ok' | 'retry' | 'fail' | 'offline' | 'aborted')
 *   - error code/message (no PII like full email body)
 *
 * Records are kept in an in-memory ring buffer that can be inspected from
 * DevTools via `window.__otpTrace` and dumped to the clipboard via
 * `window.__otpTraceDump()`. Nothing is sent to the backend automatically.
 */
export type OtpEndpoint =
  | 'validate-email'
  | 'resend-verification-code'
  | 'verify-verification-code'
  | 'health';

export type OtpOutcome = 'ok' | 'retry' | 'fail' | 'offline' | 'aborted';

export type OtpTraceEvent = {
  id: string;
  endpoint: OtpEndpoint;
  attempt: number;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  onlineAtStart: boolean;
  onlineAtEnd?: boolean;
  outcome?: OtpOutcome;
  errorCode?: string;
  errorMessage?: string;
  httpStatus?: number;
};

const RING_SIZE = 50;
const ring: OtpTraceEvent[] = [];

const isBrowser = typeof window !== 'undefined';

const isOnline = (): boolean => {
  if (!isBrowser || typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
};

const newId = (): string => {
  if (isBrowser && 'crypto' in window && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
};

const pushEvent = (event: OtpTraceEvent): void => {
  ring.push(event);
  if (ring.length > RING_SIZE) {
    ring.splice(0, ring.length - RING_SIZE);
  }
};

export type OtpTraceHandle = {
  id: string;
  attempt: number;
  /**
   * Mark this trace event as finished. Outcome categorises the result so we can
   * later see, e.g., that a "fail" actually happened while `onlineAtEnd=false`
   * (i.e. Wi-Fi dropped mid-request).
   */
  finish: (
    outcome: OtpOutcome,
    extras?: { errorCode?: string; errorMessage?: string; httpStatus?: number }
  ) => void;
};

export const startOtpTrace = (
  endpoint: OtpEndpoint,
  attempt = 1,
  parentId?: string
): OtpTraceHandle => {
  const id = parentId ?? newId();
  const startedAt = Date.now();
  const event: OtpTraceEvent = {
    id,
    endpoint,
    attempt,
    startedAt,
    onlineAtStart: isOnline(),
  };
  pushEvent(event);

  console.info(
    `[otp ${id}#${attempt}] start ${endpoint} online=${event.onlineAtStart}`
  );

  return {
    id,
    attempt,
    finish: (outcome, extras) => {
      const endedAt = Date.now();
      event.endedAt = endedAt;
      event.durationMs = endedAt - startedAt;
      event.onlineAtEnd = isOnline();
      event.outcome = outcome;
      if (extras?.errorCode) event.errorCode = extras.errorCode;
      if (extras?.errorMessage) {
        event.errorMessage = extras.errorMessage.slice(0, 240);
      }
      if (typeof extras?.httpStatus === 'number') {
        event.httpStatus = extras.httpStatus;
      }

      const networkChanged =
        event.onlineAtStart !== event.onlineAtEnd ? ' network-changed' : '';
      const status = event.httpStatus ? ` http=${event.httpStatus}` : '';
      const code = event.errorCode ? ` code=${event.errorCode}` : '';
      console.info(
        `[otp ${id}#${attempt}] ${outcome} ${endpoint} ${event.durationMs}ms` +
          ` online=${event.onlineAtEnd}${networkChanged}${status}${code}`
      );
    },
  };
};

/** Read a snapshot of the ring buffer. */
export const getOtpTrace = (): OtpTraceEvent[] => ring.slice();

/** Render the ring buffer as a single string suitable for support copy/paste. */
export const formatOtpTrace = (): string => {
  if (ring.length === 0) return '(no OTP trace events)';
  return ring
    .map((e) => {
      const ended = e.endedAt
        ? new Date(e.endedAt).toISOString()
        : '(in-flight)';
      const dur = typeof e.durationMs === 'number' ? `${e.durationMs}ms` : '-';
      const online = `${e.onlineAtStart}->${e.onlineAtEnd ?? '?'}`;
      const code = e.errorCode ? ` ${e.errorCode}` : '';
      const http = e.httpStatus ? ` http=${e.httpStatus}` : '';
      const msg = e.errorMessage ? ` "${e.errorMessage}"` : '';
      return `${ended} ${e.id}#${e.attempt} ${e.endpoint} ${e.outcome ?? '?'} ${dur} online=${online}${http}${code}${msg}`;
    })
    .join('\n');
};

if (isBrowser) {
  type WindowWithOtp = Window & {
    __otpTrace?: () => OtpTraceEvent[];
    __otpTraceDump?: () => string;
  };
  const win = window as WindowWithOtp;
  win.__otpTrace = getOtpTrace;
  win.__otpTraceDump = formatOtpTrace;
}
