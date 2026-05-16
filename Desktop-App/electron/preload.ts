import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  minimizeMainWindow: () => ipcRenderer.invoke('minimize-main-window'),
  showProfileOverlay: () => ipcRenderer.invoke('show-profile-overlay'),
  hideProfileOverlay: () => ipcRenderer.invoke('hide-profile-overlay'),
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => ipcRenderer.invoke('set-ignore-mouse-events', ignore, options),
  logout: () => ipcRenderer.invoke('logout'),
  studentLoggedIn: (data: Record<string, unknown>) => ipcRenderer.invoke('student-logged-in', data),
  reportDesktopScreen: (screenName: string) => ipcRenderer.invoke('desktop-screen-changed', screenName),
  quitApp: () => ipcRenderer.invoke('quit-app'),
});

