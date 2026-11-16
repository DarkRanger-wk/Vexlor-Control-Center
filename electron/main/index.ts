import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { extname, isAbsolute, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { AppSettings, GameEntry } from '../../src/types/app'
import { assertNoArgs, assertRecord, assertString, assertTrustedRenderer } from '../security/validation'
import { readNetworkSnapshot, readProcessList, readSystemSnapshot } from './monitor'
import { localStorage } from './storage'
import { checkLatestRelease, downloadLatestInstaller, openGitHubRelease } from './updates'
import {
  captureScreenshotDisplay,
  captureScreenshotRegion,
  captureScreenshotWindow,
  copyScreenshot,
  getScreenshotShortcut,
  initializeScreenshotShortcut,
  isValidScreenshotShortcut,
  listScreenshotDisplays,
  listScreenshotWindows,
  registerScreenshotOverlayEvents,
  saveScreenshot,
  setScreenshotMainWindow,
  setScreenshotShortcut,
} from './screenshots'
import { registerTimerWidgetEvents, setTimerWidgetMainWindow, updateTimerWidgetState } from './timer-widget'

const colorPattern = /^#[\da-fA-F]{6}$/
const imagePattern = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/
const maxImageBytes = 5 * 1024 * 1024

function register(
  channel: string,
  handler: (...args: unknown[]) => unknown | Promise<unknown>,
): void {
  ipcMain.handle(channel, async (event, ...args: unknown[]) => {
    assertTrustedRenderer(event)
    return handler(...args)
  })
}

function validateGame(value: unknown): GameEntry {
  assertRecord(value)
  const { id, name, description, category, executablePath, coverData, favorite, lastLaunchedAt } = value
  assertString(id, 'Spiel-ID', 64)
  assertString(name, 'Spielname', 80)
  assertString(description, 'Beschreibung', 500)
  assertString(category, 'Kategorie', 40)
  assertString(executablePath, 'Dateipfad', 2048)
  if (!/^[\w-]+$/.test(id) || !name.trim() || !category.trim()) throw new Error('Bitte Spielname und Kategorie ausfüllen.')
  if (!isAbsolute(executablePath) || extname(executablePath).toLowerCase() !== '.exe') {
    throw new Error('Bitte eine gültige ausführbare Windows-Datei (.exe) auswählen.')
  }
  if (coverData !== null && (typeof coverData !== 'string' || coverData.length > maxImageBytes * 1.5 || !imagePattern.test(coverData))) {
    throw new Error('Das Cover muss ein lokales PNG-, JPEG- oder WebP-Bild unter 5 MB sein.')
  }
  if (typeof favorite !== 'boolean') throw new Error('Ungültiger Favoritenstatus.')
  if (lastLaunchedAt !== undefined && lastLaunchedAt !== null && (typeof lastLaunchedAt !== 'string' || !Number.isFinite(Date.parse(lastLaunchedAt)))) {
    throw new Error('Ungültiges Startdatum.')
  }

  return {
    id,
    name: name.trim(),
    description: description.trim(),
    category: category.trim(),
    executablePath,
    coverData: coverData as string | null,
    favorite,
    lastLaunchedAt: (lastLaunchedAt as string | null | undefined) ?? null,
  }
}

function validateSettings(value: unknown): Partial<AppSettings> {
  assertRecord(value)
  const allowed = new Set(['accent', 'theme', 'animations', 'compactSidebar', 'backgroundData', 'notifications', 'autoCheckUpdates', 'screenshotShortcut'])
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`Unbekannte Einstellung: ${key}.`)
  }

  const settings: Partial<AppSettings> = {}
  if ('accent' in value) {
    if (typeof value.accent !== 'string' || !colorPattern.test(value.accent)) throw new Error('Ungültige Akzentfarbe.')
    settings.accent = value.accent
  }
  if ('theme' in value) {
    if (value.theme !== 'navy' && value.theme !== 'midnight' && value.theme !== 'graphite') throw new Error('Ungültiges Theme.')
    settings.theme = value.theme
  }
  for (const key of ['animations', 'compactSidebar', 'notifications'] as const) {
    if (key in value) {
      if (typeof value[key] !== 'boolean') throw new Error(`Ungültige Einstellung: ${key}.`)
      settings[key] = value[key]
    }
  }
  if ('autoCheckUpdates' in value) {
    if (typeof value.autoCheckUpdates !== 'boolean') throw new Error('Ungültige Einstellung: autoCheckUpdates.')
    settings.autoCheckUpdates = value.autoCheckUpdates
  }
  if ('screenshotShortcut' in value) {
    assertString(value.screenshotShortcut, 'Screenshot-Tastenkombination', 100)
    if (!isValidScreenshotShortcut(value.screenshotShortcut)) throw new Error('Ungültige Screenshot-Tastenkombination.')
    settings.screenshotShortcut = value.screenshotShortcut
  }
  if ('backgroundData' in value) {
    const image = value.backgroundData
    if (image !== null && (typeof image !== 'string' || image.length > maxImageBytes * 1.5 || !imagePattern.test(image))) {
      throw new Error('Das Hintergrundbild muss ein lokales Bild unter 5 MB sein.')
    }
    settings.backgroundData = image as string | null
  }
  return settings
}

async function chooseImage(title: string): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title,
    properties: ['openFile'],
    filters: [{ name: 'Bilder', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
  })
  if (result.canceled || !result.filePaths[0]) return null
  const imagePath = result.filePaths[0]
  const file = statSync(imagePath)
  if (!file.isFile() || file.size > maxImageBytes) throw new Error('Das Bild darf höchstens 5 MB groß sein.')
  const extension = extname(imagePath).toLowerCase()
  const mime = extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg'
  return `data:${mime};base64,${readFileSync(imagePath).toString('base64')}`
}

function registerIpcHandlers(): void {
  register('system:get-snapshot', (...args) => {
    assertNoArgs(args)
    return readSystemSnapshot()
  })
  register('system:get-processes', (...args) => {
    assertNoArgs(args)
    return readProcessList()
  })
  register('network:get-snapshot', (...args) => {
    assertNoArgs(args)
    return readNetworkSnapshot()
  })
  register('library:list', (...args) => {
    assertNoArgs(args)
    return localStorage.getGames()
  })
  register('library:save', (value) => localStorage.saveGame(validateGame(value)))
  register('library:remove', (value) => {
    assertRecord(value)
    assertString(value.id, 'Spiel-ID', 64)
    return localStorage.removeGame(value.id)
  })
  register('library:launch', async (value) => {
    assertRecord(value)
    assertString(value.id, 'Spiel-ID', 64)
    const game = localStorage.getGames().find((entry) => entry.id === value.id)
    if (!game) throw new Error('Das Spiel ist nicht mehr in der Bibliothek vorhanden.')
    if (!existsSync(game.executablePath) || !statSync(game.executablePath).isFile()) throw new Error('Die gespeicherte Spieldatei wurde nicht gefunden.')

    await new Promise<void>((resolve, reject) => {
      const child = spawn(game.executablePath, [], { detached: true, stdio: 'ignore', windowsHide: false })
      child.once('spawn', () => {
        child.unref()
        resolve()
      })
      child.once('error', reject)
    })
    localStorage.saveGame({ ...game, lastLaunchedAt: new Date().toISOString() })
  })
  register('library:choose-executable', async (...args) => {
    assertNoArgs(args)
    const result = await dialog.showOpenDialog({
      title: 'Spiel auswählen',
      properties: ['openFile'],
      filters: [{ name: 'Windows-Anwendungen', extensions: ['exe'] }],
    })
    return result.canceled ? null : result.filePaths[0] ?? null
  })
  register('library:choose-cover', (...args) => {
    assertNoArgs(args)
    return chooseImage('Spielcover auswählen')
  })
  register('settings:choose-background', (...args) => {
    assertNoArgs(args)
    return chooseImage('Hintergrundbild auswählen')
  })
  register('settings:get', (...args) => {
    assertNoArgs(args)
    return localStorage.getSettings()
  })
  register('settings:save', (value) => localStorage.saveSettings(validateSettings(value)))
  register('settings:autostart', (value) => {
    assertRecord(value)
    if (typeof value.enabled !== 'boolean') throw new Error('Ungültige Autostart-Einstellung.')
    app.setLoginItemSettings({ openAtLogin: value.enabled })
    return localStorage.saveSettings({ launchAtLogin: value.enabled })
  })
  register('settings:reset', (...args) => {
    assertNoArgs(args)
    app.setLoginItemSettings({ openAtLogin: false })
    localStorage.reset()
  })
  register('notes:get', (...args) => {
    assertNoArgs(args)
    return localStorage.getNotes()
  })
  register('notes:save', (value) => {
    assertRecord(value)
    assertString(value.notes, 'Notizen', 50000)
    localStorage.saveNotes(value.notes)
  })
  register('updates:check', (...args) => {
    assertNoArgs(args)
    return checkLatestRelease()
  })
  register('updates:open-release', async (value) => {
    assertRecord(value)
    assertString(value.tag, 'Release-Version', 100)
    return openGitHubRelease(value.tag)
  })
  register('updates:download-installer', (...args) => {
    assertNoArgs(args)
    return downloadLatestInstaller()
  })
  register('screenshot:list-displays', (...args) => {
    assertNoArgs(args)
    return listScreenshotDisplays()
  })
  register('screenshot:list-windows', (...args) => {
    assertNoArgs(args)
    return listScreenshotWindows()
  })
  register('screenshot:capture-display', (value) => {
    assertRecord(value)
    assertString(value.displayId, 'Bildschirm-ID', 100)
    return captureScreenshotDisplay(value.displayId)
  })
  register('screenshot:capture-window', (value) => {
    assertRecord(value)
    assertString(value.sourceId, 'Fenster-ID', 256)
    return captureScreenshotWindow(value.sourceId)
  })
  register('screenshot:capture-region', (...args) => {
    assertNoArgs(args)
    return captureScreenshotRegion()
  })
  register('screenshot:save', (value) => {
    assertRecord(value)
    assertString(value.imageDataUrl, 'Screenshot', 120 * 1024 * 1024)
    return saveScreenshot(value.imageDataUrl)
  })
  register('screenshot:copy', (value) => {
    assertRecord(value)
    assertString(value.imageDataUrl, 'Screenshot', 120 * 1024 * 1024)
    return copyScreenshot(value.imageDataUrl)
  })
  register('screenshot:get-shortcut', (...args) => {
    assertNoArgs(args)
    return getScreenshotShortcut()
  })
  register('screenshot:set-shortcut', (value) => {
    assertRecord(value)
    assertString(value.shortcut, 'Screenshot-Tastenkombination', 100)
    return setScreenshotShortcut(value.shortcut)
  })
  register('timer-widget:update-state', (value) => updateTimerWidgetState(value))
  register('external:open-email', async (...args) => {
    assertNoArgs(args)
    return shell.openExternal('mailto:kontakt.noah224@gmail.com')
  })
  register('window:minimize', (...args) => {
    assertNoArgs(args)
    const window = BrowserWindow.getFocusedWindow()
    if (!window) throw new Error('Das App-Fenster ist nicht verfügbar.')
    window.minimize()
  })
  register('window:toggle-maximize', (...args) => {
    assertNoArgs(args)
    const window = BrowserWindow.getFocusedWindow()
    if (!window) throw new Error('Das App-Fenster ist nicht verfügbar.')
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
  })
  register('window:close', (...args) => {
    assertNoArgs(args)
    const window = BrowserWindow.getFocusedWindow()
    if (!window) throw new Error('Das App-Fenster ist nicht verfügbar.')
    window.close()
  })
}

function createWindow(): void {
  const window = new BrowserWindow({
    frame: false,
    width: 1440,
    height: 1000,
    minWidth: 1024,
    minHeight: 700,
    title: 'Vexlor Control Center',
    backgroundColor: '#080d18',
    icon: join(__dirname, '../../assets/icons/vexlor.ico'),
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  })
  setScreenshotMainWindow(window)
  setTimerWidgetMainWindow(window)

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, destination) => {
    const rendererUrl = process.env.ELECTRON_RENDERER_URL
    const isAllowed = rendererUrl
      ? destination.startsWith(rendererUrl)
      : destination === pathToFileURL(join(__dirname, '../renderer/index.html')).href
    if (!isAllowed) event.preventDefault()
  })

  window.once('ready-to-show', () => window.show())
  if (process.env.ELECTRON_RENDERER_URL) void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void window.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  registerIpcHandlers()
  registerScreenshotOverlayEvents()
  registerTimerWidgetEvents()
  createWindow()
  initializeScreenshotShortcut()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
