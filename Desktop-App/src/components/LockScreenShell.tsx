import type { ReactNode } from 'react';
import { Power } from 'lucide-react';
import { lockScreenBackgroundStyle } from '../utils/lockScreenBackground';

type LockScreenShellProps = {
  children: ReactNode;
  showExit?: boolean;
};

export default function LockScreenShell({ children, showExit = true }: LockScreenShellProps) {
  const canQuit = typeof window !== 'undefined' && Boolean(window.electronAPI?.quitApp);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center text-white relative overflow-hidden">
      <div className="absolute inset-0" style={lockScreenBackgroundStyle} aria-hidden />
      <div className="absolute inset-0 bg-slate-900/80" aria-hidden />

      {showExit && canQuit && (
        <button
          type="button"
          onClick={() => void window.electronAPI?.quitApp?.()}
          className="absolute top-4 left-4 z-20 inline-flex items-center gap-2 rounded-lg border border-white/25 bg-black/40 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white/90 backdrop-blur-md hover:bg-red-900/60 hover:border-red-400/50 transition-colors"
          title="Close application (staff)"
        >
          <Power className="h-4 w-4" />
          Exit app
        </button>
      )}

      <div className="relative z-10 w-full flex flex-col items-center justify-center px-4 py-8">
        {children}
      </div>
    </div>
  );
}