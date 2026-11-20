import { contextBridge, ipcRenderer } from 'electron'
import type { TimerWidgetAction, VccApi } from '../../src/types/app'

const vccApi: VccApi = {
  hasTicketIdentity: () => ipcRenderer.invoke('tickets:has-identity'),
  ticketRequest: (path, options) => ipcRenderer.invoke('tickets:request', { path, ...options }),
  adminRequest: (path, options) => ipcRenderer.invoke('admin:request', { path, ...options }),
  getSystemSnapshot: () => ipcRenderer.invoke('system:get-snapshot'),
  listProcesses: () => ipcRenderer.invoke('system:get-processes'),
  getNetworkSnapshot: () => ipcRenderer.invoke('network:get-snapshot'),
  listGames: () => ipcRenderer.invoke('library:list'),
  saveGame: (game) => ipcRenderer.invoke('library:save', game),
  removeGame: (id) => ipcRenderer.invoke('library:remove', { id }),
  launchGame: (id) => ipcRenderer.invoke('library:launch', { id }),
  getArcadeProfile: () => ipcRenderer.invoke('arcade:get-profile'),
  saveArcadeProfile: (profile) => ipcRenderer.invoke('arcade:save-profile', profile),
  chooseExecutable: () => ipcRenderer.invoke('library:choose-executable'),
  chooseCover: () => ipcRenderer.invoke('library:choose-cover'),
  chooseBackground: () => ipcRenderer.invoke('settings:choose-background'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  setAutostart: (enabled) => ipcRenderer.invoke('settings:autostart', { enabled }),
  resetLocalData: () => ipcRenderer.invoke('settings:reset'),
  getNotes: () => ipcRenderer.invoke('notes:get'),
  saveNotes: (notes) => ipcRenderer.invoke('notes:save', { notes }),
  checkUpdates: () => ipcRenderer.invoke('updates:check'),
  openRelease: (tag) => ipcRenderer.invoke('updates:open-release', { tag }),
  downloadUpdate: () => ipcRenderer.invoke('updates:download-installer'),
  listScreenshotDisplays: () => ipcRenderer.invoke('screenshot:list-displays'),
  listScreenshotWindows: () => ipcRenderer.invoke('screenshot:list-windows'),
  captureScreenshotDisplay: (displayId) => ipcRenderer.invoke('screenshot:capture-display', { displayId }),
  captureScreenshotWindow: (sourceId) => ipcRenderer.invoke('screenshot:capture-window', { sourceId }),
  captureScreenshotRegion: () => ipcRenderer.invoke('screenshot:capture-region'),
  saveScreenshot: (imageDataUrl) => ipcRenderer.invoke('screenshot:save', { imageDataUrl }),
  copyScreenshot: (imageDataUrl) => ipcRenderer.invoke('screenshot:copy', { imageDataUrl }),
  getScreenshotShortcut: () => ipcRenderer.invoke('screenshot:get-shortcut'),
  setScreenshotShortcut: (shortcut) => ipcRenderer.invoke('screenshot:set-shortcut', { shortcut }),
  onScreenshotCaptured: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, imageDataUrl: string) => callback(imageDataUrl)
    ipcRenderer.on('screenshot:captured', listener)
    return () => ipcRenderer.removeListener('screenshot:captured', listener)
  },
  onScreenshotError: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, message: string) => callback(message)
    ipcRenderer.on('screenshot:error', listener)
    return () => ipcRenderer.removeListener('screenshot:error', listener)
  },
  updateTimerWidget: (state) => ipcRenderer.invoke('timer-widget:update-state', state),
  onTimerWidgetAction: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, action: TimerWidgetAction) => callback(action)
    ipcRenderer.on('timer-widget:action', listener)
    return () => ipcRenderer.removeListener('timer-widget:action', listener)
  },
  openEmail: () => ipcRenderer.invoke('external:open-email'),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggle-maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
}

contextBridge.exposeInMainWorld('vcc', vccApi)
