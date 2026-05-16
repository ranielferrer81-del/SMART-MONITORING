import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { FaUserGraduate } from 'react-icons/fa';
import { AuthenticatedUser, fetchCurrentUser } from '../api/client';
import { resolveProfilePictureUrl } from '../utils/profilePictureUrl';
import LockScreenShell from './LockScreenShell';

type StudentCredentialProps = {
  onContinue: () => void;
  user?: AuthenticatedUser | null;
};

export default function StudentCredential({ onContinue, user }: StudentCredentialProps) {
  const [profile, setProfile] = useState<AuthenticatedUser | null>(user ?? null);
  const [credentials, setCredentials] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(() => {
    if (user) return false;
    try {
      return Boolean(localStorage.getItem('token'));
    } catch {
      return false;
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  // Load credentials from localStorage if available (from email validation)
  useEffect(() => {
    try {
      const storedCredentials = localStorage.getItem('student_credentials');
      if (storedCredentials) {
        setCredentials(JSON.parse(storedCredentials));
      }
    } catch (e) {
      console.error('Failed to load credentials:', e);
    }
  }, []);

  const profilePictureUrl = useMemo(() => {
    // Prioritize profile picture from credentials (email login) over profile
    const picture = credentials?.profile_picture ?? profile?.profilePicture ?? null;
    return resolveProfilePictureUrl(picture);
  }, [credentials?.profile_picture, profile?.profilePicture]);

  // Reset image error when profile picture URL changes
  useEffect(() => {
    setImageError(false);
  }, [profilePictureUrl]);

  useEffect(() => {
    let isMounted = true;

    if (user) {
      setProfile(user);
      setIsLoading(false);
      setError(null);
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setError('Please connect using your credentials to view this screen.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    fetchCurrentUser()
      .then((data) => {
        if (!isMounted) return;
        setProfile(data);
        setError(null);
      })
      .catch((err) => {
        if (!isMounted) return;
        const rawMessage = err instanceof Error ? err.message : 'Unable to load student record.';
        const message =
          rawMessage.toLowerCase().includes('no student found')
            ? 'No student found. Please try again.'
            : rawMessage;
        setError(message);
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  return (
    <LockScreenShell>
      <motion.div
        className="relative bg-white/10 border border-white/20 backdrop-blur-xl rounded-3xl p-12 shadow-2xl max-w-2xl w-full flex flex-col items-center gap-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <motion.div
          className="w-32 h-32 rounded-full bg-gradient-to-br from-red-600 to-red-400 flex items-center justify-center shadow-xl overflow-hidden"
          animate={{ scale: [1, 1.05, 1], rotate: [0, 2, -2, 0] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          {profilePictureUrl && !imageError ? (
            <img
              src={profilePictureUrl}
              alt={credentials?.full_name ?? profile?.fullName ?? 'Profile'}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <FaUserGraduate className="w-16 h-16 text-white" />
          )}
        </motion.div>

        <div className="space-y-4 text-center">
          <p className="text-sm uppercase tracking-[0.4em] text-red-200">
            Welcome
          </p>
          <h2 className="text-4xl font-extrabold text-white drop-shadow-lg">
            {credentials?.full_name ?? profile?.fullName ?? 'Student'}
          </h2>
          <p className="text-2xl font-semibold text-white/90">
            {credentials?.course ?? profile?.course ?? '—'}
          </p>
          <p className="text-red-100 text-lg">
            {isLoading
              ? 'Fetching your record...'
              : error ?? 'Here are the credentials pulled from the backend.'}
          </p>
        </div>

        <button
          onClick={onContinue}
          disabled={isLoading || Boolean(error)}
          className="mt-6 px-10 py-3 bg-red-600 text-white font-semibold rounded-full border border-white/30 hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </motion.div>
    </LockScreenShell>
  );
}

