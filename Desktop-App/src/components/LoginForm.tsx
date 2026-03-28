import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, Loader2, X } from 'lucide-react';
import { emailLogin, verifyLaravelBackend, warmupBackend } from '../api/client';

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

  useEffect(() => {
    void warmupBackend();
    void verifyLaravelBackend().then((r) => {
      if (!r.ok) setBackendWarning(r.message);
    });
  }, []);

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
        
        // Wait a moment to show the message, then proceed
        setTimeout(() => {
          onVerificationSent(
            result.email,
            verificationCode,
            emailSent,
            result.message
          );
        }, 1500);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid email or password. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
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
            Enter Credentials
          </p>
          <h2 className="text-3xl font-extrabold text-white drop-shadow-lg">
            Student Login
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-6">
          {backendWarning && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-xl bg-amber-900/50 border border-amber-500/50 px-4 py-3 text-sm text-amber-100 backdrop-blur-sm text-left"
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

          <div className="space-y-2">
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
                className="block w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-red-200/60 focus:ring-2 focus:ring-red-500 focus:border-red-500/50 transition-all duration-200 outline-none backdrop-blur-sm"
                placeholder="Enter your email address"
                required
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-2">
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
                className="block w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-red-200/60 focus:ring-2 focus:ring-red-500 focus:border-red-500/50 transition-all duration-200 outline-none backdrop-blur-sm"
                placeholder="Enter your password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-10 py-4 bg-red-600 text-white font-semibold rounded-full border border-white/30 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-transparent transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Verifying...
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
    </div>
  );
}
