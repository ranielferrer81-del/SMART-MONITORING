import React, { useState } from 'react';
import { loginRequest } from '../api/client';
import ThemeToggle from './ThemeToggle';

const roleDefaultRoutes = {
  admin: '/admin/dashboard',
  teacher: '/teacher/dashboard',
  student: '/student/dashboard',
};

function resolveLoginRoute(payload) {
  const route = payload?.route;
  if (
    route === '/admin/dashboard' ||
    route === '/teacher/dashboard' ||
    route === '/student/dashboard'
  ) {
    return route;
  }
  const role = String(payload?.user?.role || '').toLowerCase();
  return roleDefaultRoutes[role] || '/';
}

const LoginForm = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState({});
  const [serverErrors, setServerErrors] = useState({
    email: '',
    password: '',
    emailHint: '',
  });
  const [isLoading, setIsLoading] = useState(false);


  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setServerErrors({ email: '', password: '', emailHint: '' });
    try {
      const result = await loginRequest(formData.email, formData.password);

      if (!result.ok) {
        const msg = (result.error || '').toLowerCase();
        if (msg.includes('email not found')) {
          setServerErrors({
            email: 'No account found for this email.',
            emailHint:
              'This runs on the Laravel API service (not the React static site). By default the API imports database/legacy_seed.sql when the users table is empty. If you still see this, set IMPORT_LEGACY_SEED_ON_BOOT=true once on the API service, redeploy, then set it back to auto. Use each account\'s password from that SQL dump, not the Railway MySQL password.',
            password: '',
          });
        } else if (msg.includes('incorrect password')) {
          setServerErrors({ email: '', emailHint: '', password: 'Incorrect password. Try again.' });
        } else {
          setServerErrors({
            email: result.error || 'Login failed',
            emailHint: '',
            password: '',
          });
        }
        setIsLoading(false);
        return;
      }

      try {
        localStorage.setItem('token', result.data.token);
        localStorage.setItem('user', JSON.stringify(result.data.user));
      } catch (_) { }

      window.location.href = resolveLoginRoute(result.data);
    } catch (err) {
      console.error('Login error:', err);
      alert('Network error. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] w-full max-w-[100vw] flex-col items-center justify-center overflow-hidden px-4 py-10 sm:px-6 sm:py-12">
      {/* ── Decorative backdrop ───────────────────────────── */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-dotgrid opacity-70" />
        <div className="absolute -top-40 -left-32 h-[32rem] w-[32rem] rounded-full bg-red-500/30 mix-blend-multiply blur-3xl animate-blob" />
        <div className="absolute -top-32 -right-32 h-[30rem] w-[30rem] rounded-full bg-rose-600/25 mix-blend-multiply blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute -bottom-40 left-1/4 h-[28rem] w-[28rem] rounded-full bg-red-700/20 mix-blend-multiply blur-3xl animate-blob animation-delay-4000" />
      </div>

      {/* ── Theme toggle ─────────────────────────────────── */}
      <div className="absolute right-4 top-4 z-50 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      {/* ── Login shell ─────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-lg animate-scale-in">
        {/* Header / brand */}
        <div className="mb-10 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-red-600 via-red-500 to-rose-600 blur-2xl opacity-60 animate-pulse" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-white/90 to-white/60 p-4 shadow-floating border border-white/70 dark:from-slate-900/70 dark:to-slate-800/60 dark:border-white/10 backdrop-blur-2xl">
                <img
                  src={`${process.env.PUBLIC_URL}/logo.svg`}
                  alt="S.M.A.R.T"
                  className="h-full w-full object-contain drop-shadow-sm"
                />
              </div>
            </div>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tighter-2 mb-3">
            <span className="text-red-700 dark:text-red-400">Welcome Back</span>
          </h1>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 font-medium max-w-sm mx-auto">
            Sign in to your dashboard to continue
          </p>
        </div>

        {/* ── Glass card ────────────────────────────────── */}
        <div className="relative">
          <div className="absolute -inset-[1px] rounded-[2rem] bg-gradient-to-br from-red-600/50 via-rose-500/30 to-red-700/50 opacity-60 blur-sm" aria-hidden />
          <div className="relative glass-strong rounded-[2rem] p-7 sm:p-9 overflow-hidden">
            {/* Inner glow accents */}
            <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-red-500/20 blur-3xl" aria-hidden />
            <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-rose-600/20 blur-3xl" aria-hidden />

            <form onSubmit={handleSubmit} className="relative space-y-6">
              {/* Email */}
              <div>
                <label htmlFor="email" className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2.5">
                  <svg className="h-4 w-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Email Address
                </label>
                <div className="group relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 group-focus-within:text-rose-500 transition-colors">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="you@school.edu"
                    autoComplete="email"
                    className={`w-full pl-12 pr-4 py-4 rounded-2xl border text-sm shadow-inner-soft
                      bg-white/70 dark:bg-slate-900/60 backdrop-blur
                      placeholder:text-slate-400/80 dark:placeholder:text-slate-500 text-slate-900 dark:text-slate-100
                      focus:outline-none focus:ring-4 focus:ring-rose-500/20 focus:border-rose-500/60
                      transition-all duration-300
                      ${errors.email || serverErrors.email
                        ? 'border-rose-400/70 bg-rose-50/60 dark:bg-rose-950/30'
                        : 'border-slate-200/80 hover:border-slate-300 dark:border-slate-700/70 dark:hover:border-slate-600'
                      }`}
                  />
                </div>
                {errors.email && (
                  <p className="mt-2.5 flex items-start gap-1.5 text-sm font-medium text-rose-600 dark:text-rose-400">
                    <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {errors.email}
                  </p>
                )}
                {!errors.email && serverErrors.email && (
                  <>
                    <p className="mt-2.5 flex items-start gap-1.5 text-sm font-medium text-rose-600 dark:text-rose-400">
                      <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {serverErrors.email}
                    </p>
                    {serverErrors.emailHint ? (
                      <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400 bg-slate-100/60 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-200/60 dark:border-slate-700/60">
                        {serverErrors.emailHint}
                      </p>
                    ) : null}
                  </>
                )}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2.5">
                  <svg className="h-4 w-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Password
                </label>
                <div className="group relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 group-focus-within:text-rose-500 transition-colors">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className={`w-full pl-12 pr-4 py-4 rounded-2xl border text-sm shadow-inner-soft
                      bg-white/70 dark:bg-slate-900/60 backdrop-blur
                      placeholder:text-slate-400/80 dark:placeholder:text-slate-500 text-slate-900 dark:text-slate-100
                      focus:outline-none focus:ring-4 focus:ring-rose-500/20 focus:border-rose-500/60
                      transition-all duration-300 tracking-wide
                      ${errors.password || serverErrors.password
                        ? 'border-rose-400/70 bg-rose-50/60 dark:bg-rose-950/30'
                        : 'border-slate-200/80 hover:border-slate-300 dark:border-slate-700/70 dark:hover:border-slate-600'
                      }`}
                  />
                </div>
                {errors.password && (
                  <p className="mt-2.5 flex items-start gap-1.5 text-sm font-medium text-rose-600 dark:text-rose-400">
                    <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {errors.password}
                  </p>
                )}
                {!errors.password && serverErrors.password && (
                  <p className="mt-2.5 flex items-start gap-1.5 text-sm font-medium text-rose-600 dark:text-rose-400">
                    <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {serverErrors.password}
                  </p>
                )}
              </div>

              {/* Remember / forgot */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                <label className="inline-flex items-center gap-2.5 cursor-pointer select-none group">
                  <span className="relative inline-flex h-5 w-5 items-center justify-center">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      className="peer h-5 w-5 rounded-md border-2 border-slate-300 dark:border-slate-600 text-rose-600 focus:ring-4 focus:ring-rose-500/20 cursor-pointer transition-all bg-white/60 dark:bg-slate-800/60"
                    />
                    <svg className="pointer-events-none absolute h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors">
                    Remember me
                  </span>
                </label>
                <button
                  type="button"
                  className="inline-flex items-center self-start sm:self-auto gap-1 text-sm font-semibold text-rose-600 hover:text-rose-500 dark:text-rose-400 dark:hover:text-rose-300 transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Forgot password?
                </button>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isLoading}
                className={`group relative w-full overflow-hidden rounded-2xl px-5 py-4 text-sm font-bold text-white shadow-glow transition-all duration-300
                  ${isLoading
                    ? 'cursor-not-allowed bg-slate-400 shadow-none'
                    : 'bg-gradient-to-r from-rose-500 via-red-500 to-red-500 bg-size-200 animate-gradient-shift hover:shadow-[0_20px_50px_-12px_rgba(244,63,94,0.6)] active:scale-[0.98]'
                  }`}
              >
                {!isLoading && (
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" aria-hidden />
                )}
                <span className="relative flex items-center justify-center gap-2.5 tracking-wide">
                  {isLoading ? (
                    <>
                      <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign In
                      <svg className="h-4.5 w-4.5 h-[18px] w-[18px] transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </span>
              </button>
            </form>

            {/* Divider with or */}
            <div className="my-8 flex items-center gap-4">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300/70 to-transparent dark:via-slate-700/60" />
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                S.M.A.R.T
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300/70 to-transparent dark:via-slate-700/60" />
            </div>

            {/* Footer CTA */}
            <div className="text-center">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  className="font-bold text-red-600 dark:text-red-400 hover:underline underline-offset-4 decoration-red-400/50"
                >
                  Contact Administrator
                </button>
              </p>
            </div>
          </div>
        </div>

        {/* Mini brand badge */}
        <div className="mt-10 flex items-center justify-center gap-2 text-xs font-semibold text-slate-400 dark:text-slate-500">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-gradient-to-r from-red-400 to-rose-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
          Secure · Encrypted · School Dashboard
        </div>
      </div>
    </div>
  );
};

export default LoginForm;


