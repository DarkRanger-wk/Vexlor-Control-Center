import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'node:path'
import type { TimerWidgetAction, TimerWidgetState } from '../../src/types/app'
import { assertRecord } from '../security/validation'

const idleState: TimerWidgetState = {
  timer: { status: 'idle', remainingMs: 0, deadline: null },
  stopwatch: { running: false, elapsedMs: 0, startedAt: null },
}

const widgetActions = new Set<TimerWidgetAction>([
  'open-app',
  'timer-toggle',
  'timer-reset',
  'stopwatch-toggle',
  'stopwatch-reset',
])

let mainWindow: BrowserWindow | null = null
let widgetWindow: BrowserWindow | null = null
let state: TimerWidgetState = structuredClone(idleState)
let mainCloseRequested = false
let forceQuit = false

app.on('before-quit', () => { forceQuit = true })

export function setTimerWidgetMainWindow(window: BrowserWindow): void {
  mainWindow = window
  window.on('close', (event) => {
    if (forceQuit || !hasVisibleTimer()) return
    event.preventDefault()
    mainCloseRequested = true
    window.hide()
    createWidgetWindow()
  })
}

export function updateTimerWidgetState(value: unknown): void {
  state = validateTimerWidgetState(value)
  if (hasVisibleTimer()) {
    createWidgetWindow()
    sendStateToWidget()
    return
  }

  if (widgetWindow && !widgetWindow.isDestroyed()) widgetWindow.destroy()
  widgetWindow = null
  if (mainCloseRequested && mainWindow && !mainWindow.isDestroyed()) {
    mainCloseRequested = false
    mainWindow.close()
  }
}

export function registerTimerWidgetEvents(): void {
  ipcMain.on('timer-widget:action', (event, action: unknown) => {
    if (!widgetWindow || event.sender !== widgetWindow.webContents || typeof action !== 'string' || !widgetActions.has(action as TimerWidgetAction)) return

    if (action === 'open-app') {
      showMainWindow()
      return
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('timer-widget:action', action)
    }
  })
}

function validateTimerWidgetState(value: unknown): TimerWidgetState {
  assertRecord(value)
  assertRecord(value.timer)
  assertRecord(value.stopwatch)
  const timer = value.timer
  const stopwatch = value.stopwatch
  const statuses = ['idle', 'running', 'paused', 'completed']
  if (typeof timer.status !== 'string' || !statuses.includes(timer.status)) {
    throw new Error('Ungültiger Timer-Status.')
  }
  if (typeof timer.remainingMs !== 'number' || !Number.isFinite(timer.remainingMs) || timer.remainingMs < 0) {
    throw new Error('Ungültige Timer-Zeit.')
  }
  if (timer.deadline !== null && (typeof timer.deadline !== 'number' || !Number.isFinite(timer.deadline))) {
    throw new Error('Ungültiger Timer-Endzeitpunkt.')
  }
  if (timer.status === 'running' && timer.deadline === null) throw new Error('Für einen laufenden Timer fehlt der Endzeitpunkt.')
  if (typeof stopwatch.running !== 'boolean') throw new Error('Ungültiger Stoppuhr-Status.')
  if (typeof stopwatch.elapsedMs !== 'number' || !Number.isFinite(stopwatch.elapsedMs) || stopwatch.elapsedMs < 0) {
    throw new Error('Ungültige Stoppuhr-Zeit.')
  }
  if (stopwatch.startedAt !== null && (typeof stopwatch.startedAt !== 'number' || !Number.isFinite(stopwatch.startedAt))) {
    throw new Error('Ungültiger Stoppuhr-Startzeitpunkt.')
  }
  if (stopwatch.running && stopwatch.startedAt === null) throw new Error('Für die laufende Stoppuhr fehlt der Startzeitpunkt.')

  return {
    timer: {
      status: timer.status as TimerWidgetState['timer']['status'],
      remainingMs: timer.remainingMs,
      deadline: timer.deadline as number | null,
    },
    stopwatch: {
      running: stopwatch.running,
      elapsedMs: stopwatch.elapsedMs,
      startedAt: stopwatch.startedAt as number | null,
    },
  }
}

function hasVisibleTimer(): boolean {
  return state.timer.status !== 'idle' || state.stopwatch.running || state.stopwatch.elapsedMs > 0
}

function createWidgetWindow(): void {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.setBounds(getWidgetBounds())
    if (!widgetWindow.isVisible()) widgetWindow.showInactive()
    return
  }

  const width = 338
  const height = 166
  const window = new BrowserWindow({
    ...getWidgetBounds(width, height),
    width,
    height,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    show: false,
    alwaysOnTop: true,
    roundedCorners: true,
    webPreferences: {
      preload: join(__dirname, '../preload/timer-widget.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  })
  widgetWindow = window
  window.setAlwaysOnTop(true, 'screen-saver')
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  window.on('close', (event) => {
    if (forceQuit || window !== widgetWindow) return
    event.preventDefault()
    window.hide()
    if (mainWindow && !mainWindow.isDestroyed()) showMainWindow()
  })
  window.on('closed', () => {
    if (widgetWindow === window) widgetWindow = null
  })
  window.once('ready-to-show', () => {
    if (window.isDestroyed()) return
    sendStateToWidget()
    window.showInactive()
  })
  window.webContents.on('did-finish-load', sendStateToWidget)

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(new URL('timer-widget.html', process.env.ELECTRON_RENDERER_URL).href)
  } else {
    void window.loadFile(join(__dirname, '../renderer/timer-widget.html'))
  }
}

function getWidgetBounds(width = 338, height = 166): Electron.Rectangle {
  const display = mainWindow && !mainWindow.isDestroyed()
    ? screen.getDisplayMatching(mainWindow.getBounds())
    : screen.getPrimaryDisplay()
  const { x, y, width: workWidth, height: workHeight } = display.workArea
  return {
    x: Math.max(x + 8, x + workWidth - width - 18),
    y: y + 18,
    width: Math.min(width, workWidth - 16),
    height: Math.min(height, workHeight - 36),
  }
}

function sendStateToWidget(): void {
  if (!widgetWindow || widgetWindow.isDestroyed()) return
  if (widgetWindow.webContents.isLoading()) return
  widgetWindow.webContents.send('timer-widget:state', state)
}

function showMainWindow(): void {
  mainCloseRequested = false
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.show()
  mainWindow.focus()
}
