import { useState, useEffect } from 'react';
import StudentCredential from './components/StudentCredential';
import PinEntry from './components/PinEntry';
import LoginForm from './components/LoginForm';
import EmailVerification from './components/EmailVerification';
import ProfileWidget from './components/ProfileWidget';
import { api, fetchCurrentUser, resendVerificationCode } from './api/client';
import type { LoginResult, AuthenticatedUser } from './api/client';

type Screen =
  | 'home'
  | 'student-credential'
  | 'pin'
  | 'email-login'
  | 'email-verification'
  | 'logged-in';

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [session, setSession] = useState<LoginResult | null>(null);
  const [verificationEmail, setVerificationEmail] = useState<string>('');
  const [verificationLoginDelivery, setVerificationLoginDelivery] = useState<{
    emailSent?: boolean;
    message?: string;
    /** When email fails but API returns a code (fallback / debug), passed in-memory so Strict Mode cannot lose it. */
    verificationCode?: string | null;
  }>({});

  // Restore session from localStorage if token exists
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token && !session) {
      // Try to fetch current user to restore session
      fetchCurrentUser()
        .then((user: AuthenticatedUser) => {
          const restoredSession: LoginResult = {
            ok: true,
            token: token,
            route: '/',
            user: user,
          };
          setSession(restoredSession);
          notifyElectronLogin(restoredSession);
        })
        .catch(() => {
          // Token is invalid, clear it
          localStorage.removeItem('token');
          localStorage.removeItem('user_role');
        });
    }
  }, [session]);

  // Check if we're in overlay mode (separate window for ProfileButton)
  const isOverlay = window.location.search.includes('overlay=profile') ||
    window.location.hash.includes('overlay=profile');

  // Initialize overlay window - set screen to logged-in and restore session
  useEffect(() => {
    if (isOverlay && screen === 'home') {
      setScreen('logged-in');
      const token = localStorage.getItem('token');
      if (token && !session) {
        fetchCurrentUser()
          .then((user: AuthenticatedUser) => {
            const restoredSession: LoginResult = {
              ok: true,
              token: token,
              route: '/',
              user: user,
            };
            setSession(restoredSession);
            notifyElectronLogin(restoredSession);
          })
          .catch(() => {
            // Token is invalid, close overlay
            const electronAPI = (window as any).electronAPI;
            if (electronAPI) {
              electronAPI.hideProfileOverlay();
            }
          });
      }
    }
  }, [isOverlay, screen, session]);

  useEffect(() => {
    window.electronAPI?.reportDesktopScreen?.(screen).catch(() => undefined);
  }, [screen]);

  // Extend browser token to monitoring (no PIN yet — monitoring_ready_at set only after PIN)
  const notifyElectronLogin = (session: LoginResult) => {
    const electronAPI = window.electronAPI;
    if (electronAPI && session.user) {
      electronAPI.studentLoggedIn({
        userId: session.user.id,
        email: session.user.email,
        fullName: session.user.fullName,
        token: session.token,
        monitoringReady: false,
      }).catch(console.error);
    }
  };

  // Handle session restoration when on logged-in screen (main window)
  useEffect(() => {
    if (screen === 'logged-in' && !isOverlay && !session?.user) {
      const token = localStorage.getItem('token');
      if (token) {
        // Try to restore session
        fetchCurrentUser()
          .then((user: AuthenticatedUser) => {
            const restoredSession: LoginResult = {
              ok: true,
              token: token,
              route: '/',
              user: user,
            };
            setSession(restoredSession);
            notifyElectronLogin(restoredSession);
          })
          .catch(() => {
            // Token is invalid, go back to home
            console.warn('Session lost, returning to home');
            setScreen('home');
          });
      } else {
        // No token, go back to home
        console.warn('No session or token, returning to home');
        setScreen('home');
      }
    }
  }, [screen, session, isOverlay]);

  const handleVerificationSent = (
    email: string,
    devCode?: string | null,
    emailSent?: boolean,
    sendMessage?: string
  ) => {
    setVerificationEmail(email);
    setVerificationLoginDelivery({
      emailSent,
      message: sendMessage,
      verificationCode: devCode ?? null,
    });
    setScreen('email-verification');
    // Store dev code only when backend says the email was NOT delivered.
    // This prevents the "use this verification code" UI from showing when email works.
    if (devCode && /^\d{6}$/.test(String(devCode).trim())) {
      localStorage.setItem('dev_verification_code', devCode);
    } else {
      localStorage.removeItem('dev_verification_code');
    }

    if (emailSent !== undefined) {
      localStorage.setItem('email_sent_status', emailSent ? 'true' : 'false');
    }
  };

  const handleVerificationSuccess = async (verifiedSession: LoginResult) => {
    // Use the verified session returned by /api/verify-verification-code directly.
    // Avoid an immediate extra /api/me round-trip that can fail transiently and send user back to login.
    if (verifiedSession?.token && verifiedSession?.user) {
      setSession(verifiedSession);
      setScreen('student-credential');
      return;
    }

    try {
      const user = await fetchCurrentUser();
      const token = localStorage.getItem('token');
      if (token && user) {
        const session: LoginResult = {
          ok: true,
          token: token,
          route: '/',
          user: user,
        };
        setSession(session);
        setScreen('student-credential');
        return;
      }
    } catch (error) {
      console.error('Failed to fetch user after verification:', error);
    }

    setVerificationLoginDelivery({});
    setScreen('email-login');
  };

  const handleLogout = async () => {
    // End monitoring session on backend
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await api.post('/api/browser-activity/end-my-session');
      }
    } catch (error) {
      console.error('Failed to end monitoring session:', error);
    }

    // Clear session and return to login
    localStorage.removeItem('token');
    localStorage.removeItem('user_role');
    setSession(null);

    // Use Electron API to restore main window and hide overlay
    try {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI) {
        await electronAPI.logout();
      }
    } catch (error) {
      console.error('Failed to restore window:', error);
    }

    setScreen('home');
  };

  if (screen === 'email-login') {
    return (
      <LoginForm
        onVerificationSent={handleVerificationSent}
        onCancel={() => {
          setVerificationLoginDelivery({});
          setScreen('home');
        }}
      />
    );
  }

  if (screen === 'email-verification') {
    return (
      <EmailVerification
        email={verificationEmail}
        loginDelivery={verificationLoginDelivery}
        onSuccess={(verifiedSession) => {
          setVerificationLoginDelivery({});
          void handleVerificationSuccess(verifiedSession);
        }}
        onCancel={() => {
          setVerificationLoginDelivery({});
          setScreen('email-login');
        }}
        onResend={async () => {
          return await resendVerificationCode(verificationEmail);
        }}
      />
    );
  }

  if (screen === 'student-credential') {
    return <StudentCredential onContinue={() => setScreen('pin')} user={session?.user} />;
  }

  if (screen === 'pin') {
    return (
      <PinEntry
        onSuccess={async () => {
          // PIN validated successfully - minimize main window and show overlay
          try {
            const electronAPI = (window as any).electronAPI;
            if (electronAPI) {
              await electronAPI.minimizeMainWindow();
              await electronAPI.showProfileOverlay();
              // Notify Electron about login
              if (session?.user) {
                await electronAPI.studentLoggedIn({
                  userId: session.user.id,
                  email: session.user.email,
                  fullName: session.user.fullName,
                  token: session.token,
                  monitoringReady: true,
                });
              }
            }
            // Set screen to logged-in for main window (though it will be hidden)
            setScreen('logged-in');
          } catch (error) {
            console.error('Failed to minimize window:', error);
            setScreen('logged-in');
          }
        }}
        onError={(message) => {
          // Error is already shown in PinEntry component
          console.error('PIN validation error:', message);
        }}
      />
    );
  }

  if (screen === 'logged-in' || isOverlay) {
    // If in overlay mode, show only ProfileButton with transparent background
    if (isOverlay) {
      if (!session?.user) {
        // Try to restore session from localStorage
        const token = localStorage.getItem('token');
        if (token) {
          fetchCurrentUser()
            .then((user: AuthenticatedUser) => {
              const restoredSession: LoginResult = {
                ok: true,
                token: token,
                route: '/',
                user: user,
              };
              setSession(restoredSession);
            })
            .catch(() => {
              // If can't restore, close overlay
              const electronAPI = (window as any).electronAPI;
              if (electronAPI) {
                electronAPI.hideProfileOverlay();
              }
            });
        }
        return (
          <div className="w-full h-full bg-transparent flex items-start justify-center pt-2">
            <div className="text-white">Loading...</div>
          </div>
        );
      }

      // Overlay window - show ProfileWidget only
      // Full-screen transparent window with draggable widget
      return (
        <div
          className="w-full h-full bg-transparent"
          style={{
            overflow: 'visible',
            minHeight: '100vh',
            pointerEvents: 'none' // Make container click-through, widget itself will handle events
          }}
        >
          <ProfileWidget user={session.user} onLogout={handleLogout} />
        </div>
      );
    }

    // Main window logged-in screen (should be hidden, but fallback)
    if (!session?.user) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <div className="text-white">Loading...</div>
        </div>
      );
    }

    // Main window - show ProfileWidget (though window should be minimized)
    return (
      <div className="min-h-screen bg-slate-900">
        <ProfileWidget user={session.user} onLogout={handleLogout} />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        backgroundImage: 'url(/Image1.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="flex flex-col items-center mt-30">
        <h1 className="text-6xl font-bold text-red-800 drop-shadow-lg mb-8">
          Welcome Fatimanians!
        </h1>
        <button
          onClick={() => setScreen('email-login')}
          className="px-8 py-3 bg-red-800 text-white font-bold rounded-lg hover:bg-red-900 transition-colors shadow-lg"
        >
          Login
        </button>
      </div>
    </div>
  );
}

export default App;
