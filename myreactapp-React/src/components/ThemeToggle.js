import React, { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved) {
        const isDark = saved === 'dark';
        setDark(isDark);
        document.documentElement.classList.toggle('dark', isDark);
      } else {
        // Respect OS preference on first load
        const prefers = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        setDark(prefers);
        document.documentElement.classList.toggle('dark', prefers);
      }
    } catch (_) {}
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch (_) {}
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-slate-200 text-slate-600 hover:text-indigo-700 hover:border-indigo-300 transition-colors bg-white shadow-sm dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:text-indigo-300"
    >
      {dark ? (
        // Sun icon
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.364 6.364l-1.414-1.414M8.05 8.05L6.636 6.636m10.728 0l-1.414 1.414M8.05 15.95l-1.414 1.414" />
        </svg>
      ) : (
        // Moon icon
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" />
        </svg>
      )}
    </button>
  );
}


