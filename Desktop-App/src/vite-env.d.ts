/// <reference types="vite/client" />

interface Window {
  electronAPI?: {
    minimizeMainWindow: () => Promise<void>;
    showProfileOverlay: () => Promise<void>;
    hideProfileOverlay: () => Promise<void>;
    expandProfileWindow?: () => Promise<void>;
    collapseProfileWindow?: () => Promise<void>;
    setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => Promise<void>;
    logout: () => Promise<void>;
    studentLoggedIn: (data: Record<string, unknown>) => Promise<void>;
    reportDesktopScreen?: (screenName: string) => Promise<void>;
    quitApp?: () => Promise<void>;
  };
}
