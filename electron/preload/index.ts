import { contextBridge, ipcRenderer } from 'electron'
import type { VccApi } from '../../src/types/app'

const vccApi: VccApi = {
  getSystemSnapshot: () => ipcRenderer.invoke('system:get-snapshot'),
  listProcesses: () => ipcRenderer.invoke('system:get-processes'),
  getNetworkSnapshot: () => ipcRenderer.invoke('network:get-snapshot'),
  listGames: () => ipcRenderer.invoke('library:list'),
  saveGame: (game) => ipcRenderer.invoke('library:save', game),
  removeGame: (id) => ipcRenderer.invoke('library:remove', { id }),
  launchGame: (id) => ipcRenderer.invoke('library:launch', { id }),
  chooseExecutable: () => ipcRenderer.invoke('library:choose-executable'),
  chooseCover: () => ipcRenderer.invoke('library:choose-cover'),
  chooseBackground: () => ipcRenderer.invoke('settings:choose-background'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  setAutostart: (enabled) => ipcRenderer.invoke('settings:autostart', { enabled }),
  resetLocalData: () => ipcRenderer.invoke('settings:reset'),
  getNotes: () => ipcRenderer.invoke('notes:get'),
  saveNotes: (notes) => ipcRenderer.invoke('notes:save', { notes }),
  checkUpdates: (repository) => ipcRenderer.invoke('updates:check', { repository }),
  openRelease: (repository, tag) => ipcRenderer.invoke('updates:open-release', { repository, tag }),
  downloadUpdate: (repository, tag) => ipcRenderer.invoke('updates:download-installer', { repository, tag }),
  openEmail: () => ipcRenderer.invoke('external:open-email'),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window:toggle-maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
}

contextBridge.exposeInMainWorld('vcc', vccApi)
