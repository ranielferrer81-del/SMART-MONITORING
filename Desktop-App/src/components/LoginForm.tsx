import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, Loader2, X, Globe, Laptop, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { emailLogin, verifyLaravelBackend, warmupBackend } from '../api/client';
import { getServerMode, setServerMode, getApiBaseUrl, type ServerMode } from '../config/apiBase';
import LockScreenShell from './LockScreenShell';

type LoginFormProps = {
  onVerificationSent: (
    email: string,
    devCode?: string | null,
    emailSent?: boolean,
    sendMessage?: string
  ) => void;
  onCancel?: () => void;
};

export default function LoginForm({ onVerificationSent, onCancel }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<{ sent: boolean; message: string } | null>(null);
  const [backendWarning, setBackendWarning] = useState<string | null>(null);
  const [isWarmingUp, setIsWarmingUp] = useState(true);

  const [serverMode, setLocalServerMode] = useState<ServerMode>(() => getServerMode());
  const [, setActiveBaseUrl] = useState<string>(() => getApiBaseUrl());
  const [serverStatus, setServerStatus] = useState<'connected' | 'error' | 'checking'>('checking');

  const checkConnection = useCallback(async () => {
    setIsWarmingUp(true);
    setServerStatus('checking');
    setBackendWarning(null);
    try {
      await warmupBackend();
      const r = await verifyLaravelBackend();
      if (r.ok) {
        setServerStatus('connected');
        setBackendWarning(null);
      } else {
        setServerStatus('error');
        setBackendWarning(r.message);
      }
    } catch {
      setServerStatus('error');
      setBackendWarning('Failed to reach backend.');
    } finally {
      setIsWarmingUp(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await checkConnection();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [checkConnection]);

  const handleModeSwitch = async (newMode: ServerMode) => {
    if (newMode === serverMode && serverStatus === 'connected') return;
    setLocalServerMode(newMode);
    const updatedUrl = await setServerMode(newMode);
    setActiveBaseUrl(updatedUrl);
    setError(null);
    setEmailStatus(null);
    await checkConnection();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setEmailStatus(null);

    try {
      const result = await emailLogin(email.trim().toLowerCase(), password);
      if (result.ok) {
        const emailSent = result.email_sent;
        const verificationCode = result.verification_code;
        
        // Set email status message
        if (emailSent) {
          setEmailStatus({
            sent: true,
            message: result.message || 'Verification code has been sent to your email. Please check your inbox (and spam folder).'
          });
        } else {
          const hasFallbackCode =
            result.verification_code && /^\d{6}$/.test(String(result.verification_code).trim());
          setEmailStatus({
            sent: false,
            message: hasFallbackCode
              ? (result.message || 'Use the code on the next screen to finish signing in.')
              : (result.message ||
                  'Cannot send verification code. Email service is not configured properly. Please contact support.'),
          });
        }
        
        onVerificationSent(result.email, verificationCode, emailSent, result.message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid email or password. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LockScreenShell>
      <motion.div
        className="relative bg-white/10 border border-white/20 backdrop-blur-xl rounded-3xl p-10 shadow-2xl max-w-md w-full flex flex-col items-center gap-5"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <motion.div
          className="w-16 h-16 rounded-full bg-gradient-to-br from-red-600 to-red-400 flex items-center justify-center shadow-xl"
          animate={{ scale: [1, 1.05, 1], rotate: [0, 2, -2, 0] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <Mail className="w-8 h-8 text-white" />
        </motion.div>

        <div className="space-y-1 w-full text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-red-200">
            Enter Credentials
          </p>
          <h2 className="text-2xl font-extrabold text-white drop-shadow-lg">
            Student Login
          </h2>
        </div>

        {/* Server Selector Bar */}
        <div className="w-full flex flex-col items-center gap-2">
          <div className="flex items-center bg-black/40 p-1 rounded-2xl border border-white/10 backdrop-blur-md w-full">
            <button
              type="button"
              onClick={() => handleModeSwitch('cloud')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all duration-200 ${
                serverMode === 'cloud'
                  ? 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-md'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Online (Cloud)</span>
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch('local')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all duration-200 ${
                serverMode === 'local'
                  ? 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-md'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>Localhost (127.0.0.1)</span>
            </button>
          </div>

          {/* Connection status badge */}
          <div className="flex items-center justify-between w-full px-1 text-xs">
            <div className="flex items-center gap-1.5 text-white/70">
              {serverStatus === 'checking' && (
                <>
                  <Loader2 className="w-3 h-3 text-amber-300 animate-spin" />
                  <span className="text-amber-200/90">Connecting to {serverMode === 'cloud' ? 'Render Cloud' : 'Localhost'}...</span>
                </>
              )}
              {serverStatus === 'connected' && (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-300">Connected to {serverMode === 'cloud' ? 'Render Cloud' : 'Localhost'}</span>
                </>
              )}
              {serverStatus === 'error' && (
                <>
                  <AlertCircle className="w-3 h-3 text-red-400" />
                  <span className="text-red-300">Offline / Unreachable</span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => checkConnection()}
              disabled={isWarmingUp}
              title="Test connection"
              className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 ${isWarmingUp ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-5">
          {backendWarning && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-xl bg-amber-900/50 border border-amber-500/50 px-4 py-3 text-xs text-amber-100 backdrop-blur-sm text-left"
            >
              {backendWarning}
            </motion.div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-xl bg-red-900/50 border border-red-500/50 px-4 py-3 text-sm text-red-100 backdrop-blur-sm"
            >
              {error}
            </motion.div>
          )}

          {emailStatus && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`rounded-xl px-4 py-3 text-sm backdrop-blur-sm ${
                emailStatus.sent
                  ? 'bg-green-900/50 border border-green-500/50 text-green-100'
                  : 'bg-yellow-900/50 border border-yellow-500/50 text-yellow-100'
              }`}
            >
              {emailStatus.message}
            </motion.div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-xs uppercase tracking-[0.3em] text-red-200 text-left">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-red-300" />
              </div>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-12 pr-4 py-3.5 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-red-200/60 focus:ring-2 focus:ring-red-500 focus:border-red-500/50 transition-all duration-200 outline-none backdrop-blur-sm"
                placeholder="Enter your email address"
                required
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-xs uppercase tracking-[0.3em] text-red-200 text-left">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-red-300" />
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-12 pr-4 py-3.5 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-red-200/60 focus:ring-2 focus:ring-red-500 focus:border-red-500/50 transition-all duration-200 outline-none backdrop-blur-sm"
                placeholder="Enter your password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || isWarmingUp}
            className="w-full px-10 py-3.5 bg-red-600 text-white font-semibold rounded-full border border-white/30 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-transparent transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Sending code...
              </span>
            ) : isWarmingUp ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Connecting...
              </span>
            ) : (
              'Sign In'
            )}
          </button>

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
    </LockScreenShell>
  );
}

