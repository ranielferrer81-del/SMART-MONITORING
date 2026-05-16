import type { CSSProperties } from 'react';

/**
 * Bundled-friendly lock screen background (works in Electron file:// and Vite dev).
 * Replaces missing /Image1.jpg which 404s in packaged builds.
 */
export const lockScreenBackgroundStyle: CSSProperties = {
  backgroundColor: '#0f172a',
  backgroundImage: [
    'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(220, 38, 38, 0.35), transparent)',
    'radial-gradient(ellipse 60% 40% at 100% 100%, rgba(127, 29, 29, 0.25), transparent)',
    'radial-gradient(ellipse 50% 35% at 0% 80%, rgba(30, 41, 59, 0.9), transparent)',
    'linear-gradient(160deg, #0f172a 0%, #1e293b 40%, #450a0a 100%)',
  ].join(', '),
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
};
