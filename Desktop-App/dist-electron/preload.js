import { contextBridge, ipcRenderer } from 'electron';
// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    minimizeMainWindow: () => ipcRenderer.invoke('minimize-main-window'),
    showProfileOverlay: () => ipcRenderer.invoke('show-profile-overlay'),
    hideProfileOverlay: () => ipcRenderer.invoke('hide-profile-overlay'),
    setIgnoreMouseEvents: (ignore, options) => ipcRenderer.invoke('set-ignore-mouse-events', ignore, options),
    logout: () => ipcRenderer.invoke('logout'),
    studentLoggedIn: (data) => ipcRenderer.invoke('student-logged-in', data),
    studentLoggedOut: () => ipcRenderer.invoke('student-logged-out'),
    reportDesktopScreen: (screenName) => ipcRenderer.invoke('desktop-screen-changed', screenName),
    quitApp: () => ipcRenderer.invoke('quit-app'),
    getStudentToken: () => ipcRenderer.invoke('get-student-token'),
    onLockScreenReset: (callback) => {
        const listener = () => callback();
        ipcRenderer.on('lock-screen-reset', listener);
        return () => {
            ipcRenderer.removeListener('lock-screen-reset', listener);
        };
    },
    onPcLocked: (callback) => {
        const listener = (_event, message) => callback(message);
        ipcRenderer.on('pc-locked', listener);
        return () => {
            ipcRenderer.removeListener('pc-locked', listener);
        };
    },
    onPcUnlocked: (callback) => {
        const listener = () => callback();
        ipcRenderer.on('pc-unlocked', listener);
        return () => {
            ipcRenderer.removeListener('pc-unlocked', listener);
        };
    },
    onPresentationStart: (callback) => {
        const listener = (_event, data) => callback(data);
        ipcRenderer.on('presentation-start', listener);
        return () => {
            ipcRenderer.removeListener('presentation-start', listener);
        };
    },
    onPresentationEnd: (callback) => {
        const listener = () => callback();
        ipcRenderer.on('presentation-end', listener);
        return () => {
            ipcRenderer.removeListener('presentation-end', listener);
        };
    },
    onQuizStart: (callback) => {
        const listener = (_event, data) => callback(data);
        ipcRenderer.on('quiz-start', listener);
        return () => {
            ipcRenderer.removeListener('quiz-start', listener);
        };
    },
    onQuizEnd: (callback) => {
        const listener = () => callback();
        ipcRenderer.on('quiz-end', listener);
        return () => {
            ipcRenderer.removeListener('quiz-end', listener);
        };
    },
    quizDismiss: () => ipcRenderer.invoke('quiz-dismiss'),
    setApiBaseUrl: (url) => ipcRenderer.invoke('set-api-base-url', url),
});
