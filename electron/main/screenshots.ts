import { app, BrowserWindow, ClipboardItem, clipboard, desktopCapturer, dialog, globalShortcut, ipcMain, nativeImage, screen, type DesktopCapturerSource } from 'electron'
import { writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import type { ScreenshotDisplay, ScreenshotShortcutStatus, ScreenshotWindow } from '../../src/types/app'
import { scaleScreenshotRectangle } from '../../src/services/screenshot'
import type { ScreenshotRectangle } from '../../src/services/screenshot'
import { assertRecord, assertString } from '../security/validation'
import { localStorage } from './storage'

interface RegionCapture {
  image: Electron.NativeImage
  display: Electron.Display
  window: BrowserWindow
}

interface RegionSession {
  windows: Map<number, RegionCapture>
  resolve: (image: string | null) => void
  reject: (error: Error) => void
  settled: boolean
  restoreWindow: boolean
  showAfterCapture: boolean
}

let mainWindow: BrowserWindow | null = null
let activeRegionSession: RegionSession | null = null
let registeredShortcut: string | null = null

const screenshotShortcutPattern = /^(?:(?:Ctrl|Alt|Shift|Super)\+){1,3}(?:[A-Z0-9]|F(?:[1-9]|1[0-2])|PrintScreen|Space|Comma|Period|Plus|Minus)$/i
const maxScreenshotDataUrlLength = 120 * 1024 * 1024
const maxScreenshotPixels = 100_000_000

export function isValidScreenshotShortcut(shortcut: string): boolean {
  return screenshotShortcutPattern.test(shortcut)
}

export function setScreenshotMainWindow(window: BrowserWindow): void {
  mainWindow = window
}

export function initializeScreenshotShortcut(): ScreenshotShortcutStatus {
  let shortcut = localStorage.getSettings().screenshotShortcut
  if (!isValidScreenshotShortcut(shortcut)) return { shortcut, registered: false }
  let registered = globalShortcut.register(shortcut, handleGlobalShortcut)
  if (!registered && shortcut === 'Super+Shift+S') {
    shortcut = 'Ctrl+Shift+S'
    registered = globalShortcut.register(shortcut, handleGlobalShortcut)
  }
  registeredShortcut = registered ? shortcut : null
  return { shortcut, registered }
}

export function getScreenshotShortcut(): ScreenshotShortcutStatus {
  return {
    shortcut: registeredShortcut ?? localStorage.getSettings().screenshotShortcut,
    registered: registeredShortcut !== null,
  }
}

export function setScreenshotShortcut(shortcut: string): ScreenshotShortcutStatus {
  if (!isValidScreenshotShortcut(shortcut)) {
    throw new Error('Bitte eine Tastenkombination mit Modifier und einer Taste auswählen.')
  }

  if (shortcut === registeredShortcut) return getScreenshotShortcut()

  const previous = registeredShortcut
  if (previous) globalShortcut.unregister(previous)

  if (!globalShortcut.register(shortcut, handleGlobalShortcut)) {
    registeredShortcut = previous && globalShortcut.register(previous, handleGlobalShortcut) ? previous : null
    throw new Error('Diese Tastenkombination ist bereits belegt oder wird von Windows reserviert.')
  }

  try {
    localStorage.saveSettings({ screenshotShortcut: shortcut })
  } catch (error) {
    globalShortcut.unregister(shortcut)
    registeredShortcut = previous && globalShortcut.register(previous, handleGlobalShortcut) ? previous : null
    throw error
  }

  registeredShortcut = shortcut
  return { shortcut, registered: true }
}

export function listScreenshotDisplays(): ScreenshotDisplay[] {
  const primaryId = screen.getPrimaryDisplay().id
  return screen.getAllDisplays().map((display, index) => ({
    id: String(display.id),
    label: `Bildschirm ${index + 1} · ${display.bounds.width} × ${display.bounds.height} · ${Math.round(display.scaleFactor * 100)} %${display.id === primaryId ? ' · Hauptbildschirm' : ''}`,
    primary: display.id === primaryId,
  }))
}

export async function listScreenshotWindows(): Promise<ScreenshotWindow[]> {
  const sources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: { width: 480, height: 300 },
    fetchWindowIcons: false,
  })

  return sources
    .filter((source) => source.name.trim() && !source.thumbnail.isEmpty())
    .map((source) => ({
      id: source.id,
      title: source.name,
      thumbnail: source.thumbnail.toDataURL(),
    }))
}

export async function captureScreenshotDisplay(displayId: string): Promise<string> {
  const display = screen.getAllDisplays().find((item) => String(item.id) === displayId)
  if (!display) throw new Error('Der ausgewählte Bildschirm ist nicht mehr verfügbar.')

  const wasVisible = hideMainWindow()
  try {
    await delay(120)
    const source = await getDisplaySource(display)
    return source.thumbnail.toDataURL()
  } finally {
    restoreMainWindow(wasVisible)
  }
}

export async function captureScreenshotWindow(sourceId: string): Promise<string> {
  assertString(sourceId, 'Fenster-ID', 256)
  const wasVisible = hideMainWindow()
  try {
    await delay(120)
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 3840, height: 2160 },
      fetchWindowIcons: false,
    })
    const source = sources.find((item) => item.id === sourceId)
    if (!source) throw new Error('Das ausgewählte Fenster ist nicht mehr verfügbar. Bitte aktualisiere die Fensterliste.')
    if (source.thumbnail.isEmpty()) throw new Error('Für dieses Fenster ist kein Screenshot verfügbar.')
    return source.thumbnail.toDataURL()
  } finally {
    restoreMainWindow(wasVisible)
  }
}

export async function captureScreenshotRegion(showAfterCapture = false): Promise<string | null> {
  if (activeRegionSession) throw new Error('Eine Bereichsauswahl läuft bereits.')

  const wasVisible = hideMainWindow()
  await delay(120)
  const displays = screen.getAllDisplays()
  if (displays.length === 0) {
    restoreMainWindow(wasVisible)
    throw new Error('Es wurde kein Bildschirm gefunden.')
  }

  let sources: DesktopCapturerSource[]
  try {
    sources = await getDisplaySources()
  } catch (error) {
    restoreMainWindow(wasVisible)
    throw error
  }

  return new Promise<string | null>((resolve, reject) => {
    const session: RegionSession = {
      windows: new Map(),
      resolve,
      reject,
      settled: false,
      restoreWindow: wasVisible,
      showAfterCapture,
    }
    activeRegionSession = session

    try {
      for (const display of displays) {
        const source = sources.find((item) => item.display_id === String(display.id))
        if (!source || source.thumbnail.isEmpty()) {
          throw new Error(`Für Bildschirm ${display.id} konnte kein Screenshot erstellt werden.`)
        }

        const overlay = new BrowserWindow({
          x: display.bounds.x,
          y: display.bounds.y,
          width: display.bounds.width,
          height: display.bounds.height,
          frame: false,
          transparent: false,
          resizable: false,
          movable: false,
          minimizable: false,
          maximizable: false,
          fullscreenable: false,
          skipTaskbar: true,
          show: false,
          backgroundColor: '#080d18',
          webPreferences: {
            preload: join(__dirname, '../preload/screenshot.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        })

        overlay.setAlwaysOnTop(true, 'screen-saver')
        overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
        session.windows.set(overlay.webContents.id, { image: source.thumbnail, display, window: overlay })
        overlay.on('closed', () => {
          if (activeRegionSession === session && !session.settled) settleRegionSession(session, null)
        })

        const initialized = () => {
          if (overlay.isDestroyed() || session.settled) return
          overlay.webContents.send('screenshot:overlay:init', { image: source.thumbnail.toDataURL() })
          overlay.show()
          overlay.focus()
        }

        if (process.env.ELECTRON_RENDERER_URL) {
          void overlay.loadURL(new URL('screenshot-overlay.html', process.env.ELECTRON_RENDERER_URL).href).then(initialized, (error: Error) => {
            failRegionSession(session, error)
          })
        } else {
          void overlay.loadFile(join(__dirname, '../renderer/screenshot-overlay.html')).then(initialized, (error: Error) => {
            failRegionSession(session, error)
          })
        }
      }
    } catch (error) {
      failRegionSession(session, error instanceof Error ? error : new Error('Bereichsauswahl konnte nicht gestartet werden.'))
    }
  })
}

export function registerScreenshotOverlayEvents(): void {
  ipcMain.on('screenshot:overlay-complete', (event, value: unknown) => {
    const session = activeRegionSession
    const capture = session?.windows.get(event.sender.id)
    if (!session || !capture || session.settled) return

    try {
      validateScreenshotRectangle(value)
      const { x, y, width, height } = value
      const [contentWidth, contentHeight] = capture.window.getContentSize()
      const crop = scaleScreenshotRectangle(
        { x, y, width, height },
        { width: contentWidth, height: contentHeight },
        capture.image.getSize(),
      )
      settleRegionSession(session, capture.image.crop(crop).toDataURL())
    } catch (error) {
      failRegionSession(session, error instanceof Error ? error : new Error('Screenshot-Bereich konnte nicht erstellt werden.'))
    }
  })

  ipcMain.on('screenshot:overlay-cancel', (event) => {
    const session = activeRegionSession
    if (session?.windows.has(event.sender.id)) settleRegionSession(session, null)
  })
}

export async function saveScreenshot(imageDataUrl: string): Promise<boolean> {
  const image = parseScreenshot(imageDataUrl)
  const defaultPath = join(app.getPath('pictures'), `Vexlor-Screenshot-${fileTimestamp()}.png`)
  const options = {
    title: 'Screenshot speichern',
    defaultPath,
    buttonLabel: 'Speichern',
    filters: [{ name: 'PNG-Bild', extensions: ['png'] }],
  }
  const result = mainWindow && !mainWindow.isDestroyed()
    ? await dialog.showSaveDialog(mainWindow, options)
    : await dialog.showSaveDialog(options)
  if (result.canceled || !result.filePath) return false

  const filePath = extname(result.filePath).toLowerCase() === '.png' ? result.filePath : `${result.filePath}.png`
  await writeFile(filePath, image.toPNG(), { flag: 'w' })
  return true
}

export async function copyScreenshot(imageDataUrl: string): Promise<void> {
  const image = parseScreenshot(imageDataUrl)
  const png = image.toPNG()
  const bytes = new Uint8Array(png.byteLength)
  bytes.set(png)
  await clipboard.write([new ClipboardItem({ 'image/png': new Blob([bytes.buffer], { type: 'image/png' }) })])
}

function parseScreenshot(imageDataUrl: string): Electron.NativeImage {
  assertString(imageDataUrl, 'Screenshot', maxScreenshotDataUrlLength)
  if (!imageDataUrl.startsWith('data:image/png;base64,')) throw new Error('Der Screenshot muss ein PNG-Bild sein.')
  const image = nativeImage.createFromDataURL(imageDataUrl)
  const size = image.getSize()
  if (image.isEmpty() || size.width < 1 || size.height < 1 || size.width * size.height > maxScreenshotPixels) {
    throw new Error('Der Screenshot ist ungültig oder zu groß.')
  }
  return image
}

async function getDisplaySources(): Promise<DesktopCapturerSource[]> {
  const displays = screen.getAllDisplays()
  const width = Math.max(...displays.map((display) => Math.ceil(display.bounds.width * display.scaleFactor)))
  const height = Math.max(...displays.map((display) => Math.ceil(display.bounds.height * display.scaleFactor)))
  return desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width, height },
    fetchWindowIcons: false,
  })
}

async function getDisplaySource(display: Electron.Display): Promise<DesktopCapturerSource> {
  const sources = await getDisplaySources()
  const source = sources.find((item) => item.display_id === String(display.id))
  if (!source || source.thumbnail.isEmpty()) throw new Error('Der Bildschirm konnte nicht aufgenommen werden.')
  return source
}

function handleGlobalShortcut(): void {
  void captureScreenshotRegion(true).then((image) => {
    if (!image || !mainWindow || mainWindow.isDestroyed()) return
    mainWindow.show()
    mainWindow.focus()
    mainWindow.webContents.send('screenshot:captured', image)
  }).catch((error: unknown) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.webContents.send('screenshot:error', error instanceof Error ? error.message : 'Screenshot konnte nicht erstellt werden.')
    }
  })
}

function settleRegionSession(session: RegionSession, image: string | null): void {
  if (session.settled) return
  session.settled = true
  for (const { window } of session.windows.values()) {
    if (!window.isDestroyed()) window.close()
  }
  session.windows.clear()
  if (activeRegionSession === session) activeRegionSession = null
  restoreMainWindow(session.restoreWindow || (session.showAfterCapture && image !== null))
  session.resolve(image)
}

function failRegionSession(session: RegionSession, error: Error): void {
  if (session.settled) return
  session.settled = true
  for (const { window } of session.windows.values()) {
    if (!window.isDestroyed()) window.close()
  }
  session.windows.clear()
  if (activeRegionSession === session) activeRegionSession = null
  restoreMainWindow(session.restoreWindow || session.showAfterCapture)
  session.reject(error)
}

function hideMainWindow(): boolean {
  if (!mainWindow || mainWindow.isDestroyed()) return false
  const wasVisible = mainWindow.isVisible()
  if (wasVisible) mainWindow.hide()
  return wasVisible
}

function restoreMainWindow(shouldShow: boolean): void {
  if (!shouldShow || !mainWindow || mainWindow.isDestroyed()) return
  mainWindow.show()
  mainWindow.focus()
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function validateScreenshotRectangle(value: unknown): asserts value is ScreenshotRectangle {
  assertRecord(value)
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    if (typeof value[key] !== 'number' || !Number.isFinite(value[key])) {
      throw new Error('Ungültiger Auswahlbereich.')
    }
  }
}

function fileTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}
