import { useEffect, useState } from 'react';
import { Lock, Power, ShieldAlert } from 'lucide-react';
import { lockScreenBackgroundStyle } from '../utils/lockScreenBackground';

type PcLockOverlayProps = {
  message: string;
};

export default function PcLockOverlay({ message }: PcLockOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const canQuit =
    typeof window !== 'undefined' && Boolean((window as Window).electronAPI?.quitApp);

  // Fade-in on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  // Live clock
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const timeStr = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const dateStr = currentTime.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center text-white overflow-hidden"
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.4s ease',
      }}
    >
      {/* Background image layer */}
      <div className="absolute inset-0" style={lockScreenBackgroundStyle} aria-hidden />

      {/* Dark overlay — heavier than normal lock screen to indicate restriction */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(3, 7, 18, 0.88)' }}
        aria-hidden
      />

      {/* Animated scan-line effect for visual effect */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(239,68,68,0.02) 2px, rgba(239,68,68,0.02) 4px)',
        }}
        aria-hidden
      />

      {/* Exit button — top-left, always accessible for testing */}
      {canQuit && (
        <button
          type="button"
          onClick={() => void (window as Window).electronAPI?.quitApp?.()}
          className="absolute top-4 left-4 z-20 inline-flex items-center gap-2 rounded-lg border border-white/25 bg-black/40 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white/90 backdrop-blur-md hover:bg-red-900/60 hover:border-red-400/50 transition-colors"
          title="Close application (staff)"
        >
          <Power className="h-4 w-4" />
          Exit App
        </button>
      )}

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center px-6 text-center max-w-2xl w-full">

        {/* Pulsing shield icon */}
        <div
          className="mb-8 relative"
          style={{ animation: 'pclock-pulse 2.5s ease-in-out infinite' }}
        >
          <div
            className="absolute inset-0 rounded-full blur-2xl"
            style={{ backgroundColor: 'rgba(239,68,68,0.25)', animation: 'pclock-ping 2.5s ease-in-out infinite' }}
            aria-hidden
          />
          <div
            className="relative flex items-center justify-center w-28 h-28 rounded-full border-2"
            style={{
              backgroundColor: 'rgba(127,29,29,0.4)',
              borderColor: 'rgba(248,113,113,0.5)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <Lock className="h-14 w-14 text-red-400" strokeWidth={1.5} />
          </div>
        </div>

        {/* Headline */}
        <div className="mb-2 flex items-center gap-2 justify-center">
          <ShieldAlert className="h-5 w-5 text-red-400" />
          <span
            className="text-xs font-bold uppercase tracking-[0.3em]"
            style={{ color: 'rgba(248,113,113,0.9)' }}
          >
            Access Restricted
          </span>
          <ShieldAlert className="h-5 w-5 text-red-400" />
        </div>

        <h1
          className="text-5xl font-extrabold tracking-tight mb-6"
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #fca5a5 60%, #ef4444 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          This PC is Locked
        </h1>

        {/* Custom message box */}
        <div
          className="w-full rounded-xl px-8 py-5 mb-8 border"
          style={{
            backgroundColor: 'rgba(127,29,29,0.25)',
            borderColor: 'rgba(248,113,113,0.3)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <p className="text-base text-white/90 leading-relaxed font-medium">
            {message}
          </p>
        </div>

        {/* Hint */}
        <p className="text-sm text-white/45 mb-10">
          Contact your professor or administrator to regain access.
        </p>

        {/* Divider */}
        <div
          className="w-48 h-px mb-8"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(248,113,113,0.4), transparent)' }}
          aria-hidden
        />

        {/* Live clock */}
        <div className="text-center">
          <div className="text-4xl font-mono font-bold tracking-widest text-white/80 mb-1">
            {timeStr}
          </div>
          <div className="text-sm text-white/40 tracking-wide">
            {dateStr}
          </div>
        </div>

        {/* School branding */}
        <div className="mt-12">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/30">
            SMART Monitoring System
          </p>
        </div>
      </div>

      {/* Keyframe styles injected inline */}
      <style>{`
        @keyframes pclock-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }
        @keyframes pclock-ping {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.3); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
