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
    studentLoggedOut?: () => Promise<void>;
    reportDesktopScreen?: (screenName: string) => Promise<void>;
    quitApp?: () => Promise<void>;
    onLockScreenReset?: (callback: () => void) => () => void;
    onPcLocked?: (callback: (message: string) => void) => () => void;
    onPcUnlocked?: (callback: () => void) => () => void;
    onPresentationStart?: (
      callback: (data: {
        sessionUuid: string;
        teacherName: string | null;
        subjectName: string | null;
      }) => void
    ) => () => void;
    onPresentationEnd?: (callback: () => void) => () => void;
    onQuizStart?: (
      callback: (data: {
        quizId: number;
        title: string;
        subjectName: string | null;
        timeLimitMinutes: number;
        totalQuestions: number;
        token: string | null;
      }) => void
    ) => () => void;
    onQuizEnd?: (callback: () => void) => () => void;
    quizDismiss?: () => Promise<void>;
  };
}
