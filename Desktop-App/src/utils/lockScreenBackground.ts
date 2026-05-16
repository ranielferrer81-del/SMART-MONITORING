import type { CSSProperties } from 'react';

/** Vite copies public/Image1.jpg → dist/Image1.jpg; base `./` works in Electron file:// */
const lockScreenImageUrl = `${import.meta.env.BASE_URL}Image1.jpg`;

export const lockScreenBackgroundStyle: CSSProperties = {
  backgroundColor: '#0f172a',
  backgroundImage: `url(${lockScreenImageUrl})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
};
