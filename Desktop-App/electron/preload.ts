import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  minimizeMainWindow: () => ipcRenderer.invoke('minimize-main-window'),
  showProfileOverlay: () => ipcRenderer.invoke('show-profile-overlay'),
  hideProfileOverlay: () => ipcRenderer.invoke('hide-profile-overlay'),
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) =>
    ipcRenderer.invoke('set-ignore-mouse-events', ignore, options),
  logout: () => ipcRenderer.invoke('logout'),
  studentLoggedIn: (data: Record<string, unknown>) => ipcRenderer.invoke('student-logged-in', data),
  studentLoggedOut: () => ipcRenderer.invoke('student-logged-out'),
  reportDesktopScreen: (screenName: string) => ipcRenderer.invoke('desktop-screen-changed', screenName),
  quitApp: () => ipcRenderer.invoke('quit-app'),
  getStudentToken: (): Promise<string | null> => ipcRenderer.invoke('get-student-token'),
  onLockScreenReset: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('lock-screen-reset', listener);
    return () => {
      ipcRenderer.removeListener('lock-screen-reset', listener);
    };
  },
  onPcLocked: (callback: (message: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, message: string) => callback(message);
    ipcRenderer.on('pc-locked', listener);
    return () => {
      ipcRenderer.removeListener('pc-locked', listener);
    };
  },
  onPcUnlocked: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('pc-unlocked', listener);
    return () => {
      ipcRenderer.removeListener('pc-unlocked', listener);
    };
  },
  onPresentationStart: (
    callback: (data: {
      sessionUuid: string;
      teacherName: string | null;
      subjectName: string | null;
      token: string | null;
    }) => void
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: { sessionUuid: string; teacherName: string | null; subjectName: string | null; token: string | null }
    ) => callback(data);
    ipcRenderer.on('presentation-start', listener);
    return () => {
      ipcRenderer.removeListener('presentation-start', listener);
    };
  },
  onPresentationEnd: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('presentation-end', listener);
    return () => {
      ipcRenderer.removeListener('presentation-end', listener);
    };
  },
  onQuizStart: (
    callback: (data: {
      quizId: number;
      title: string;
      subjectName: string | null;
      timeLimitMinutes: number;
      totalQuestions: number;
      token: string | null;
    }) => void
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: {
        quizId: number;
        title: string;
        subjectName: string | null;
        timeLimitMinutes: number;
        totalQuestions: number;
        token: string | null;
      }
    ) => callback(data);
    ipcRenderer.on('quiz-start', listener);
    return () => {
      ipcRenderer.removeListener('quiz-start', listener);
    };
  },
  onQuizEnd: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('quiz-end', listener);
    return () => {
      ipcRenderer.removeListener('quiz-end', listener);
    };
  },
  quizDismiss: () => ipcRenderer.invoke('quiz-dismiss'),
  setApiBaseUrl: (url: string) => ipcRenderer.invoke('set-api-base-url', url),
});
