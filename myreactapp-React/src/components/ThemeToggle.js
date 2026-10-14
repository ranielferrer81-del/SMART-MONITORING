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
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="group relative inline-flex h-10 w-10 items-center justify-center rounded-2xl
        border border-white/60 bg-white/60 text-slate-700
        shadow-soft backdrop-blur-xl
        hover:border-red-300/60 hover:shadow-glow hover:text-red-600
        focus:outline-none focus:ring-4 focus:ring-red-500/20
        dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-200
        dark:hover:border-red-500/30 dark:hover:text-red-300
        transition-all duration-300 ease-out active:scale-95"
    >
      <span className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: 'radial-gradient(circle at 50% 50%, rgba(220,38,38,0.12), transparent 70%)' }}
        aria-hidden
      />
      <span className="relative transition-all duration-500 ease-out"
        style={{ transform: dark ? 'rotate(0deg)' : 'rotate(-15deg) scale(1.05)' }}
      >
        {dark ? (
          <svg className="h-5 w-5 text-rose-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
        ) : (
          <svg className="h-5 w-5 text-red-500 drop-shadow-[0_0_6px_rgba(99,102,241,0.4)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
          </svg>
        )}
      </span>
    </button>
  );
}

