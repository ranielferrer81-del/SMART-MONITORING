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
    // Clear error when user starts typing
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

      // Save token and user info
      try {
        localStorage.setItem('token', result.data.token);
        localStorage.setItem('user', JSON.stringify(result.data.user));
      } catch (_) { }

      // Redirect to role-based dashboard
      window.location.href = resolveLoginRoute(result.data);
    } catch (err) {
      console.error('Login error:', err);
      alert('Network error. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] w-full max-w-[100vw] flex-col items-center justify-center overflow-x-hidden overflow-y-auto bg-slate-50 px-3 py-10 dark:bg-slate-900 sm:px-4 sm:py-12">
      {/* Animated Background Mesh */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-rose-400/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-400/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-1/3 w-96 h-96 bg-violet-400/30 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>
        <div className="absolute inset-0 bg-grid-slate-200/[0.04] bg-[length:32px_32px] dark:bg-grid-slate-800/[0.04]"></div>
      </div>

      {/* Theme toggle */}
      <div className="absolute right-4 top-4 z-50 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-6 flex justify-center">
            <img
              src={`${process.env.PUBLIC_URL}/logo.svg`}
              alt="S.M.A.R.T"
              className="h-14 sm:h-16 w-auto max-w-[min(100%,320px)] drop-shadow-md dark:opacity-95"
            />
          </div>
          <h2 className="text-4xl font-bold text-slate-900 dark:text-slate-50 mb-3 tracking-tight">
            Welcome Back
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-lg">
            Sign in to access your dashboard
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white/60 backdrop-blur-3xl rounded-[2rem] shadow-2xl border border-white/40 dark:bg-slate-900/60 dark:border-white/10 p-8 transition-all duration-300 hover:shadow-rose-500/10">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className={`w-full px-4 py-3.5 border rounded-xl shadow-sm focus:outline-none focus:ring-4 focus:ring-rose-500/20 focus:border-rose-500 transition-all duration-300 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm ${errors.email ? 'border-red-300 bg-red-50/10' : 'border-slate-200 dark:border-slate-700 dark:text-slate-100'
                  }`}
                placeholder="Enter your email"
              />
              {errors.email && (
                <p className="mt-2 text-sm text-red-600 font-medium">{errors.email}</p>
              )}
              {!errors.email && serverErrors.email && (
                <>
                  <p className="mt-2 text-sm text-red-600 font-medium">{serverErrors.email}</p>
                  {serverErrors.emailHint ? (
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {serverErrors.emailHint}
                    </p>
                  ) : null}
                </>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                className={`w-full px-4 py-3.5 border rounded-xl shadow-sm focus:outline-none focus:ring-4 focus:ring-rose-500/20 focus:border-rose-500 transition-all duration-300 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm ${errors.password ? 'border-red-300 bg-red-50/10' : 'border-slate-200 dark:border-slate-700 dark:text-slate-100'
                  }`}
                placeholder="Enter your password"
              />
              {errors.password && (
                <p className="mt-2 text-sm text-red-600 font-medium">{errors.password}</p>
              )}
              {!errors.password && serverErrors.password && (
                <p className="mt-2 text-sm text-red-600 font-medium">{serverErrors.password}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-rose-600 focus:ring-rose-500 border-slate-300 rounded cursor-pointer"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-600 dark:text-slate-400 font-medium cursor-pointer">
                  Remember me
                </label>
              </div>
              <div className="text-sm">
                <button type="button" className="font-semibold text-rose-600 hover:text-rose-500 transition-colors">
                  Forgot password?
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white transition-all duration-300 transform ${isLoading
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 hover:scale-[1.02] hover:shadow-rose-500/25'
                }`}
            >
              {isLoading ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-slate-500 dark:text-slate-400 font-medium">
          <p>
            Don't have an account?{' '}
            <button type="button" className="font-bold text-rose-600 hover:text-rose-500 transition-colors">
              Contact Administrator
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
