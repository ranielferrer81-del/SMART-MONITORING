import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mail, Loader2, X, RefreshCw } from 'lucide-react';
import { verifyEmailCode, resendVerificationCode } from '../api/client';

type EmailVerificationProps = {
  email: string;
  /** Result of the last /api/validate-email call (includes fallback verification_code when mail fails). */
  loginDelivery?: { emailSent?: boolean; message?: string; verificationCode?: string | null };
  onSuccess: () => void;
  onCancel?: () => void;
  onResend?: () => Promise<
    { ok: boolean; message: string; email_sent?: boolean; verification_code?: string | null } | void
  >;
};

export default function EmailVerification({
  email,
  loginDelivery,
  onSuccess,
  onCancel,
  onResend,
}: EmailVerificationProps) {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Mail send failures — kept visible while editing the code (unlike `error`, which clears on input). */
  const [deliveryFailureMessage, setDeliveryFailureMessage] = useState<string | null>(null);
  // Only show the scary "mail not configured" warning after the user actually fails verification.
  // This prevents false alarms when the backend reports email_sent=false but the OTP still arrives.
  const [verificationFailed, setVerificationFailed] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState<boolean | null>(null);
  const [resendStatus, setResendStatus] = useState<{ sent: boolean; message: string } | null>(null);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Fallback code: prefer parent props (survives React Strict Mode); then localStorage legacy.
  useEffect(() => {
    const propCode = loginDelivery?.verificationCode?.trim();
    const emailDelivered = loginDelivery?.emailSent === true;

    // API may include verification_code as backup even when email_sent is true — still show "check inbox" UX.
    if (propCode && /^\d{6}$/.test(propCode) && emailDelivered) {
      setCode(propCode);
      setDevCode(null);
      setEmailSent(true);
      setVerificationFailed(false);
      setDeliveryFailureMessage(null);
      return;
    }

    if (propCode && /^\d{6}$/.test(propCode) && !emailDelivered) {
      setCode(propCode);
      setDevCode(propCode);
      setEmailSent(false);
      setVerificationFailed(false);
      setDeliveryFailureMessage(null);
      return;
    }

    const storedCode = localStorage.getItem('dev_verification_code');
    const emailSentStatus = localStorage.getItem('email_sent_status');

    if (storedCode && emailSentStatus === 'false' && /^\d{6}$/.test(storedCode)) {
      setCode(storedCode);
      setDevCode(storedCode);
      setEmailSent(false);
      setVerificationFailed(false);
      setDeliveryFailureMessage(null);
      localStorage.removeItem('dev_verification_code');
      localStorage.removeItem('email_sent_status');
      return;
    }

    if (!storedCode) {
      localStorage.removeItem('dev_verification_code');
    }

    if (loginDelivery?.emailSent !== undefined) {
      setEmailSent(loginDelivery.emailSent);
      if (loginDelivery.emailSent === false) {
        const hasCode =
          loginDelivery.verificationCode &&
          /^\d{6}$/.test(String(loginDelivery.verificationCode).trim());
        setDeliveryFailureMessage(null);
        setVerificationFailed(!hasCode);
      } else {
        setDeliveryFailureMessage(null);
        setVerificationFailed(false);
      }
      return;
    }

    if (emailSentStatus === null) {
      setEmailSent(null);
    } else {
      setEmailSent(emailSentStatus === 'true');
    }
  }, [loginDelivery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setVerificationFailed(false);

    try {
      await verifyEmailCode(email.trim().toLowerCase(), code.trim());
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid verification code. Please try again.';
      setError(message);
      setVerificationFailed(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;

    setIsResending(true);
    setError(null);
    setDeliveryFailureMessage(null);
    setResendStatus(null);
    setVerificationFailed(false);

    let resendUiTimer: ReturnType<typeof setTimeout> | undefined;
    const RESEND_UI_MAX_MS = 40_000;

    try {
      const deadline = new Promise<never>((_, reject) => {
        resendUiTimer = setTimeout(() => {
          reject(
            new Error(
              'This is taking too long. If you already see a sign-in code above, enter it — it is still valid. Otherwise try Resend again in a moment.'
            )
          );
        }, RESEND_UI_MAX_MS);
      });

      await Promise.race([
        (async () => {
          let result;

          if (onResend) {
            const resendResult = await onResend();
            if (resendResult && typeof resendResult === 'object' && 'email_sent' in resendResult) {
              result = resendResult as {
                ok: boolean;
                message: string;
                email_sent?: boolean;
                verification_code?: string | null;
              };
            } else {
              result = await resendVerificationCode(email.trim().toLowerCase());
            }
          } else {
            result = await resendVerificationCode(email.trim().toLowerCase());
          }

          const emailWasSent = result?.email_sent === true;
          const fallbackCode =
            result && typeof result === 'object' && 'verification_code' in result
              ? (result as { verification_code?: string | null }).verification_code
              : null;

          if (emailWasSent) {
            setResendStatus({
              sent: true,
              message:
                result?.message ||
                'Verification code has been resent to your email. Please check your inbox (and spam folder).',
            });
            setEmailSent(true);
            setDevCode(null);
            setDeliveryFailureMessage(null);
          } else {
            const hasFallback = fallbackCode && /^\d{6}$/.test(fallbackCode);
            if (hasFallback) {
              setCode(fallbackCode);
              setDevCode(fallbackCode);
              localStorage.setItem('dev_verification_code', fallbackCode);
              localStorage.setItem('email_sent_status', 'false');
              setEmailSent(false);
              setDeliveryFailureMessage(null);
              setVerificationFailed(false);
              setResendStatus({
                sent: true,
                message: 'Your sign-in code is shown above. Enter it to continue.',
              });
            } else {
              const failMsg = 'We could not send a new code. Try again in a moment or contact support.';
              setResendStatus({ sent: false, message: failMsg });
              setEmailSent(false);
              setDeliveryFailureMessage(failMsg);
              setVerificationFailed(true);
            }
          }

          setCountdown(60);
        })(),
        deadline,
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resend code. Please try again.';
      const hasCodeOnScreen = code.trim().length === 6;
      setError(message);
      setDeliveryFailureMessage(hasCodeOnScreen ? null : message);
      setVerificationFailed(!hasCodeOnScreen);
      setResendStatus({
        sent: false,
        message,
      });
    } finally {
      if (resendUiTimer !== undefined) {
        clearTimeout(resendUiTimer);
      }
      setIsResending(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center text-center text-white relative overflow-hidden"
      style={{
        backgroundImage: 'url(/Image1.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="absolute inset-0 bg-slate-900/80" />

      <motion.div
        className="relative bg-white/10 border border-white/20 backdrop-blur-xl rounded-3xl p-12 shadow-2xl max-w-md w-full flex flex-col items-center gap-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <motion.div
          className="w-20 h-20 rounded-full bg-gradient-to-br from-red-600 to-red-400 flex items-center justify-center shadow-xl"
          animate={{ scale: [1, 1.05, 1], rotate: [0, 2, -2, 0] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <Mail className="w-10 h-10 text-white" />
        </motion.div>

        <div className="space-y-2 w-full">
          <p className="text-sm uppercase tracking-[0.4em] text-red-200">
            Verify Your Email
          </p>
          <h2 className="text-3xl font-extrabold text-white drop-shadow-lg">
            Enter Verification Code
          </h2>
          {emailSent === true ? (
            <>
              <p className="text-sm text-green-200/80 mt-2">
                ✅ Verification code has been sent to:
              </p>
              <p className="text-base font-semibold text-white">
                {email}
              </p>
              <p className="text-xs text-green-200/60 mt-1">
                Please check your inbox and spam folder.
              </p>
            </>
          ) : devCode ? (
            <>
              <p className="text-sm text-green-200/90 mt-2">
                Your sign-in code
              </p>
              <p className="text-2xl font-bold text-white tracking-[0.2em] tabular-nums">
                {devCode}
              </p>
              <p className="text-xs text-white/70 mt-2">
                We could not send the code to your inbox (check server mail settings). Use the code above to finish
                signing in.
              </p>
            </>
          ) : emailSent === false ? (
            <>
              {verificationFailed ? (
                <>
                  <p className="text-sm text-white/80 mt-2">
                    If you still need a code, try resend below or use the code shown above.
                  </p>
                  <p className="text-base font-semibold text-white mt-1">{email}</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-white/80 mt-2">
                    If you don't see the code yet, it may take a moment. You can resend it below.
                  </p>
                  <p className="text-xs text-white/60 mt-2">
                    Tip: check spam/junk folder too.
                  </p>
                </>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-red-200/80 mt-2">
                Enter the verification code sent to:
              </p>
              <p className="text-base font-semibold text-white">
                {email}
              </p>
            </>
          )}
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-6">
          {(error || (deliveryFailureMessage && !devCode)) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-xl px-4 py-3 text-sm backdrop-blur-sm space-y-2 bg-red-900/50 border border-red-500/50 text-red-100"
            >
              {deliveryFailureMessage && (
                <p className="font-medium">{deliveryFailureMessage}</p>
              )}
              {error && error !== deliveryFailureMessage && <p>{error}</p>}
            </motion.div>
          )}

          {resendStatus && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`rounded-xl px-4 py-3 text-sm backdrop-blur-sm ${
                resendStatus.sent
                  ? 'bg-green-900/50 border border-green-500/50 text-green-100'
                  : 'bg-yellow-900/50 border border-yellow-500/50 text-yellow-100'
              }`}
            >
              {resendStatus.message}
            </motion.div>
          )}

          <div className="space-y-2">
            <label htmlFor="code" className="block text-xs uppercase tracking-[0.3em] text-red-200 text-left">
              Verification Code
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-red-300" />
              </div>
              <input
                id="code"
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                  setError(null);
                }}
                className="block w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-red-200/60 focus:ring-2 focus:ring-red-500 focus:border-red-500/50 transition-all duration-200 outline-none backdrop-blur-sm text-center text-2xl font-bold tracking-widest"
                placeholder="000000"
                required
                maxLength={6}
                autoFocus
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || code.length !== 6}
            className="w-full px-10 py-4 bg-red-600 text-white font-semibold rounded-full border border-white/30 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-transparent transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Verifying...
              </span>
            ) : (
              'Verify Code'
            )}
          </button>

          {onResend && (
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending || countdown > 0}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-white/30 px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10 transition-colors backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isResending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : countdown > 0 ? (
                `Resend code in ${countdown}s`
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Resend Verification Code
                </>
              )}
            </button>
          )}

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-white/30 px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10 transition-colors backdrop-blur-sm"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          )}
        </form>
      </motion.div>
    </div>
  );
}

