/// <reference types="vite/client" />

interface Window {
  electronAPI?: {
    minimizeMainWindow: () => Promise<void>;
    showProfileOverlay: () => Promise<void>;
    hideProfileOverlay: () => Promise<void>;
    expandProfileWindow: () => Promise<void>;
    collapseProfileWindow: () => Promise<void>;
    logout: () => Promise<void>;
  };
}
