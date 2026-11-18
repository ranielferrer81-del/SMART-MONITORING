import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaUserShield } from 'react-icons/fa';
import { Loader2 } from 'lucide-react';
import { validatePin } from '../api/client';
import LockScreenShell from './LockScreenShell';

type PinEntryProps = {
  onSuccess?: () => void;
  onError?: (message: string) => void;
};

export default function PinEntry({ onSuccess, onError }: PinEntryProps) {
  const [pin, setPin] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Auto-validate when PIN reaches 4 digits
    if (pin.length === 4 && !isValidating) {
      handleValidate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  const handleValidate = async () => {
    if (pin.length !== 4) {
      setError('PIN must be 4 digits');
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      const result = await validatePin(pin);
      if (result.ok) {
        setError(null);
        if (onSuccess) {
          onSuccess();
        }
      } else {
        setError(result.message || 'Incorrect PIN. Please try again.');
        setPin('');
        if (onError) {
          onError(result.message || 'Incorrect PIN');
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to validate PIN';
      setError(message);
      setPin('');
      if (onError) {
        onError(message);
      }
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <LockScreenShell>
      <motion.div
        className="relative bg-white/10 border border-white/20 backdrop-blur-xl rounded-3xl p-10 sm:p-12 shadow-2xl max-w-lg w-full flex flex-col items-center gap-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <FaUserShield className="w-20 h-20 text-red-400" />

        <div className="space-y-3">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white drop-shadow-lg">
            Enter 4-digit PIN
          </h2>
          <p className="text-red-100 text-base sm:text-lg">
            Enter the PIN you set in your student dashboard.
          </p>
        </div>

        <div className="relative">
          <input
            type="password"
            value={pin}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '').slice(0, 4);
              setPin(value);
              setError(null);
            }}
            maxLength={4}
            placeholder="••••"
            disabled={isValidating}
            className="mt-2 w-48 text-center text-3xl sm:text-4xl tracking-[0.4em] bg-black/40 border border-white/30 rounded-full px-6 py-4 outline-none focus:ring-2 focus:ring-red-500 placeholder:text-red-200/70 disabled:opacity-50"
            autoFocus
          />
          {isValidating && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-red-400" />
            </div>
          )}
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-base text-red-300 font-semibold max-w-sm"
          >
            {error}
          </motion.p>
        )}

        {!error && !isValidating && (
          <p className="text-sm sm:text-base text-red-100/85">
            PIN will be securely verified against your account.
          </p>
        )}
      </motion.div>
    </LockScreenShell>
  );
}

