import { app, BrowserWindow, dialog, ipcMain, Menu, safeStorage, shell } from 'electron'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { extname, isAbsolute, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { AppSettings, CustomizationColors, CustomizationSettings, CustomizationValues, GameEntry } from '../../src/types/app'
import { assertNoArgs, assertRecord, assertString, assertTrustedRenderer } from '../security/validation'
import { readNetworkSnapshot, readProcessList, readSystemSnapshot } from './monitor'
import { localStorage } from './storage'
import { getTicketIdentity, hasTicketIdentity } from './ticket-identity'
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
import { registerTelemetryLifecycle, setTelemetryEnabled } from './telemetry'

const colorPattern = /^#[\da-fA-F]{6}$/
const imagePattern = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/
const maxImageBytes = 5 * 1024 * 1024
const customizationColorKeys = ['accent', 'background', 'sidebar', 'card', 'menu', 'button', 'border', 'text', 'muted'] as const
const customizationIcons = new Set(['dashboard', 'monitor', 'library', 'performance', 'network', 'tools', 'arcade', 'target', 'clock', 'crown', 'bolt', 'launch', 'screenshot', 'copy', 'save', 'zoomIn', 'zoomOut', 'settings', 'refresh', 'cpu', 'memory', 'windows', 'spark', 'arrow'])
const customizationNavigation = new Set(['Dashboard', 'System Monitor', 'Spielebibliothek', 'Performance', 'Network Center', 'Gaming Tools', 'Vexlor Arcade', 'Screenshot Tool', 'Customization', 'Einstellungen', 'Über Vexlor'])
const adminApiBaseUrl = 'https://infos-vcc.pages.dev'
const ticketApiBaseUrl = 'https://infos-vcc.pages.dev'
const adminSessionFile = join(app.getPath('userData'), 'admin-session.bin')
let adminSessionCookie: string | null = null
let userPresenceTimer: NodeJS.Timeout | null = null

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

function validateCustomizationColors(value: unknown): CustomizationColors {
  assertRecord(value)
  const colors = {} as CustomizationColors
  for (const key of customizationColorKeys) {
    if (typeof value[key] !== 'string' || !colorPattern.test(value[key])) throw new Error(`Ungültige Customization-Farbe: ${key}.`)
    colors[key] = value[key]
  }
  return colors
}

function validateCustomizationNumber(record: Record<string, unknown>, key: string, min: number, max: number): number {
  const value = record[key]
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`Ungültiger Customization-Wert: ${key}.`)
  }
  return value
}

function validateCustomizationBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key]
  if (typeof value !== 'boolean') throw new Error(`Ungültiger Customization-Wert: ${key}.`)
  return value
}

function validateCustomizationValues(value: unknown): CustomizationValues {
  assertRecord(value)
  assertString(value.themeId, 'Theme-ID', 100)
  assertRecord(value.background)
  assertRecord(value.layout)
  const colors = validateCustomizationColors(value.colors)
  const background = value.background
  const layout = value.layout
  if (background.mode !== 'solid' && background.mode !== 'gradient' && background.mode !== 'image') throw new Error('Ungültiger Hintergrundmodus.')
  const gradientStart = background.gradientStart
  const gradientEnd = background.gradientEnd
  if (typeof gradientStart !== 'string' || !colorPattern.test(gradientStart)
    || typeof gradientEnd !== 'string' || !colorPattern.test(gradientEnd)) throw new Error('Ungültige Verlaufsfarbe.')
  const imageData = background.imageData
  if (imageData !== null && (typeof imageData !== 'string' || imageData.length > maxImageBytes * 1.5 || !imagePattern.test(imageData))) {
    throw new Error('Das Hintergrundbild muss ein lokales Bild unter 5 MB sein.')
  }
  const blur = validateCustomizationNumber(background, 'blur', 0, 24)
  const opacity = validateCustomizationNumber(background, 'opacity', 0, 100)
  const sidebarWidth = validateCustomizationNumber(layout, 'sidebarWidth', 180, 340)
  const fontSize = validateCustomizationNumber(layout, 'fontSize', 9, 16)
  const radius = validateCustomizationNumber(layout, 'radius', 0, 24)
  const transparency = validateCustomizationNumber(layout, 'transparency', 0, 30)
  const animationSpeed = validateCustomizationNumber(layout, 'animationSpeed', 0.5, 2)
  const compactSidebar = validateCustomizationBoolean(layout, 'compactSidebar')
  const shadows = validateCustomizationBoolean(layout, 'shadows')
  const glow = validateCustomizationBoolean(layout, 'glow')
  const animations = validateCustomizationBoolean(layout, 'animations')
  const fontFamilies = new Set(['DM Sans', 'Segoe UI', 'Arial', 'Verdana', 'Consolas'])
  const fontFamily = layout.fontFamily
  if (typeof fontFamily !== 'string' || !fontFamilies.has(fontFamily)) throw new Error('Ungültige Schriftart.')
  assertRecord(layout.sidebarIcons)
  const sidebarIcons: Record<string, string> = {}
  for (const [label, icon] of Object.entries(layout.sidebarIcons)) {
    if (!customizationNavigation.has(label) || typeof icon !== 'string' || !customizationIcons.has(icon)) {
      throw new Error('Ungültiges Sidebar-Symbol.')
    }
    sidebarIcons[label] = icon
  }

  return {
    themeId: value.themeId,
    colors,
    background: {
      mode: background.mode,
      gradientStart,
      gradientEnd,
      imageData: imageData as string | null,
      blur,
      opacity,
    },
    layout: {
      sidebarWidth,
      compactSidebar,
      fontSize,
      fontFamily,
      radius,
      transparency,
      shadows,
      glow,
      animations,
      animationSpeed,
      sidebarIcons,
    },
  }
}

function validateCustomization(value: unknown): CustomizationSettings {
  assertRecord(value)
  if (JSON.stringify(value).length > 18 * 1024 * 1024) throw new Error('Die Customization-Einstellungen sind zu groß.')
  if (!Array.isArray(value.profiles) || value.profiles.length < 1 || value.profiles.length > 16
    || !Array.isArray(value.themes) || value.themes.length > 24
    || !Array.isArray(value.palettes) || value.palettes.length > 24) {
    throw new Error('Ungültige Customization-Listen.')
  }
  assertString(value.activeProfileId, 'Aktive Profil-ID', 100)
  const validateNamedValues = (entry: unknown, label: string) => {
    assertRecord(entry)
    assertString(entry.id, `${label}-ID`, 100)
    assertString(entry.name, label, 40)
    if (!/^[\w-]+$/.test(entry.id) || !entry.name.trim()) throw new Error(`Ungültiger ${label}.`)
    return { id: entry.id, name: entry.name.trim(), values: validateCustomizationValues(entry.values) }
  }
  const profiles = value.profiles.map((profile) => validateNamedValues(profile, 'Profil'))
  const themes = value.themes.map((theme) => validateNamedValues(theme, 'Theme'))
  if (!profiles.some((profile) => profile.id === value.activeProfileId)) throw new Error('Das aktive Designprofil wurde nicht gefunden.')
  const palettes = value.palettes.map((palette: unknown) => {
    assertRecord(palette)
    assertString(palette.id, 'Paletten-ID', 100)
    assertString(palette.name, 'Palettenname', 40)
    if (!/^[\w-]+$/.test(palette.id) || !palette.name.trim()) throw new Error('Ungültige Farbpalette.')
    return { id: palette.id, name: palette.name.trim(), colors: validateCustomizationColors(palette.colors) }
  })
  return { activeProfileId: value.activeProfileId, values: validateCustomizationValues(value.values), profiles, themes, palettes }
}

function validateSettings(value: unknown): Partial<AppSettings> {
  assertRecord(value)
  const allowed = new Set(['username', 'accent', 'theme', 'animations', 'compactSidebar', 'backgroundData', 'customization', 'notifications', 'autoCheckUpdates', 'telemetryEnabled', 'screenshotShortcut', 'gamingProfileName', 'gameSoundEnabled', 'gameSoundVolume', 'dashboardElements'])
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`Unbekannte Einstellung: ${key}.`)
  }

  const settings: Partial<AppSettings> = {}
  if ('username' in value) {
    assertString(value.username, 'Nutzername', 24)
    const username = value.username.trim()
    if (!username || /[\u0000-\u001f\u007f]/.test(username)) throw new Error('Bitte gib einen gültigen Nutzernamen ein.')
    settings.username = username
  }
  if ('customization' in value) settings.customization = validateCustomization(value.customization)
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
  for (const key of ['autoCheckUpdates', 'telemetryEnabled'] as const) {
    if (key in value) {
      if (typeof value[key] !== 'boolean') throw new Error(`Ungültige Einstellung: ${key}.`)
      settings[key] = value[key]
    }
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
  if ('gamingProfileName' in value) {
    assertString(value.gamingProfileName, 'Gaming-Profilname', 40)
    if (!value.gamingProfileName.trim()) throw new Error('Der Gaming-Profilname darf nicht leer sein.')
    settings.gamingProfileName = value.gamingProfileName.trim()
  }
  if ('gameSoundEnabled' in value) {
    if (typeof value.gameSoundEnabled !== 'boolean') throw new Error('Ungültige Sound-Einstellung.')
    settings.gameSoundEnabled = value.gameSoundEnabled
  }
  if ('gameSoundVolume' in value) {
    if (typeof value.gameSoundVolume !== 'number' || !Number.isFinite(value.gameSoundVolume)
      || value.gameSoundVolume < 0 || value.gameSoundVolume > 1) throw new Error('Ungültige Lautstärke.')
    settings.gameSoundVolume = value.gameSoundVolume
  }
  if ('dashboardElements' in value) {
    assertRecord(value.dashboardElements)
    const keys = ['systemStats', 'systemOverview', 'library', 'arcade', 'quickActions'] as const
    const dashboardElements = {} as AppSettings['dashboardElements']
    for (const key of keys) {
      if (typeof value.dashboardElements[key] !== 'boolean') throw new Error(`Ungültige Dashboard-Einstellung: ${key}.`)
      dashboardElements[key] = value.dashboardElements[key]
    }
    settings.dashboardElements = dashboardElements
  }
  return settings
}

function clearAdminSession(): void {
  adminSessionCookie = null
  rmSync(adminSessionFile, { force: true })
}

function persistAdminSession(): void {
  if (!adminSessionCookie) throw new Error('Die Admin-Sitzung kann nicht gespeichert werden.')
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Der sichere Windows-Speicher ist nicht verfügbar. Die Admin-Anmeldung kann nicht dauerhaft gespeichert werden.')
  }
  mkdirSync(app.getPath('userData'), { recursive: true })
  const content = JSON.stringify({ version: app.getVersion(), cookie: adminSessionCookie })
  writeFileSync(adminSessionFile, safeStorage.encryptString(content), { mode: 0o600 })
}

function restoreAdminSession(): boolean {
  if (!existsSync(adminSessionFile)) return false
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('Der sichere Windows-Speicher ist nicht verfügbar; die gespeicherte Admin-Sitzung wurde nicht geladen.')
    return false
  }

  try {
    const stored: unknown = JSON.parse(safeStorage.decryptString(readFileSync(adminSessionFile)))
    if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) {
      throw new Error('Die gespeicherte Admin-Sitzung hat ein ungültiges Format.')
    }
    const session = stored as { version?: unknown; cookie?: unknown }
    if (typeof session.version !== 'string'
      || typeof session.cookie !== 'string'
      || !/^vcc_admin_session=[A-Za-z0-9_-]+$/.test(session.cookie)) {
      throw new Error('Die gespeicherte Admin-Sitzung ist ungültig.')
    }

    adminSessionCookie = session.cookie
    return session.version !== app.getVersion()
  } catch (error) {
    clearAdminSession()
    console.error('Die gespeicherte Admin-Sitzung konnte nicht geladen werden:', error)
    return false
  }
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

async function requestAdminApi(value: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  assertRecord(value)
  assertString(value.path, 'Admin-API-Pfad', 2048)
  const method = value.method ?? 'GET'
  if (method !== 'GET' && method !== 'POST') throw new Error('Ungültige Admin-API-Methode.')
  if (value.body !== undefined) assertString(value.body, 'Admin-API-Daten', 65536)
  if (method === 'GET' && value.body !== undefined) throw new Error('GET-Anfragen dürfen keinen Inhalt haben.')

  const url = new URL(value.path, adminApiBaseUrl)
  if (url.origin !== adminApiBaseUrl || !url.pathname.startsWith('/api/admin/')) {
    throw new Error('Nicht autorisierter Admin-API-Pfad.')
  }

  const headers = new Headers({ Accept: 'application/json' })
  if (value.body !== undefined) headers.set('Content-Type', 'application/json')
  if (adminSessionCookie) headers.set('Cookie', adminSessionCookie)
  const response = await fetch(url, {
    method,
    headers,
    body: value.body,
    signal: AbortSignal.timeout(15000),
  })

  const responseText = await response.text()
  let responseBody: unknown
  try {
    responseBody = JSON.parse(responseText)
  } catch {
    responseBody = { error: 'Die Antwort des Admin-Servers ist ungültig.' }
  }
  if (typeof responseBody !== 'object' || responseBody === null || Array.isArray(responseBody)) {
    responseBody = { error: 'Die Antwort des Admin-Servers ist ungültig.' }
  }
  assertRecord(responseBody)

  const isLogin = url.pathname === '/api/admin/auth/login' && method === 'POST'
  if (isLogin && response.ok) {
    const cookie = response.headers.get('set-cookie')
    const match = cookie?.match(/(?:^|,\s*)vcc_admin_session=([^;,\s]+)/)
    if (!match) throw new Error('Der Admin-Server hat keine gültige Sitzung ausgegeben.')
    adminSessionCookie = `vcc_admin_session=${match[1]}`
    persistAdminSession()
  } else if (response.status === 401) {
    clearAdminSession()
  } else if (url.pathname === '/api/admin/auth/me' && method === 'POST' && response.ok) {
    clearAdminSession()
  }

  return { status: response.status, body: responseBody }
}

async function requestTicketApi(value: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  assertRecord(value)
  assertString(value.path, 'Ticket-API-Pfad', 2048)
  const method = value.method ?? 'GET'
  if (method !== 'GET' && method !== 'POST') throw new Error('Ungültige Ticket-API-Methode.')
  if (value.body !== undefined) assertString(value.body, 'Ticket-API-Daten', 2 * 1024 * 1024)
  if (method === 'GET' && value.body !== undefined) throw new Error('GET-Anfragen dürfen keinen Inhalt haben.')

  const url = new URL(value.path, ticketApiBaseUrl)
  if (url.origin !== ticketApiBaseUrl
    || (url.pathname !== '/api/tickets' && !url.pathname.startsWith('/api/tickets/')
      && !['/api/codes/redeem', '/api/codes/rewards', '/api/arcade/profile', '/api/users/presence'].includes(url.pathname))) {
    throw new Error('Nicht autorisierter Installations-API-Pfad.')
  }
  if (!hasTicketIdentity() && method === 'GET' && url.pathname === '/api/tickets') {
    return { status: 200, body: { ok: true, tickets: [], unreadCount: 0 } }
  }

  const identity = getTicketIdentity()
  const headers = new Headers({
    Accept: 'application/json',
    Authorization: `Bearer ${identity.token}`,
    'X-VCC-Install-Id': identity.installId,
    'X-VCC-Display-Name': localStorage.getSettings().username || 'Lokaler Nutzer',
  })
  if (value.body !== undefined) headers.set('Content-Type', 'application/json')
  const response = await fetch(url, {
    method,
    headers,
    body: value.body,
    signal: AbortSignal.timeout(30000),
  })
  let responseBody: unknown
  try {
    responseBody = await response.json()
  } catch {
    responseBody = { error: 'Die Antwort des Ticketdienstes ist ungültig.' }
  }
  if (typeof responseBody !== 'object' || responseBody === null || Array.isArray(responseBody)) {
    responseBody = { error: 'Die Antwort des Ticketdienstes ist ungültig.' }
  }
  assertRecord(responseBody)
  return { status: response.status, body: responseBody }
}

async function reportUserPresence(): Promise<void> {
  const displayName = localStorage.getSettings().username.trim()
  if (!displayName) return

  const result = await requestTicketApi({
    path: '/api/users/presence',
    method: 'POST',
    body: '{}',
  })
  if (result.status < 200 || result.status >= 300) {
    throw new Error(typeof result.body.error === 'string' ? result.body.error : 'Der Online-Status konnte nicht übermittelt werden.')
  }
}

function startUserPresence(): void {
  const send = () => {
    void reportUserPresence().catch((error: unknown) => {
      console.warn('Der App-Online-Status konnte nicht aktualisiert werden:', error)
    })
  }
  send()
  userPresenceTimer = setInterval(send, 60_000)
}

async function revokeAdminSessionForUpdate(): Promise<void> {
  if (!adminSessionCookie) {
    clearAdminSession()
    return
  }

  try {
    const result = await requestAdminApi({ path: '/api/admin/auth/me', method: 'POST' })
    if (result.status < 200 || result.status >= 300) {
      throw new Error(typeof result.body.error === 'string' ? result.body.error : 'Die Admin-Sitzung wurde nicht widerrufen.')
    }
  } catch (error) {
    clearAdminSession()
    console.warn('Die lokale Admin-Sitzung wurde vor dem Update gelöscht; der serverseitige Widerruf ist fehlgeschlagen:', error)
  }
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
  register('arcade:get-profile', (...args) => {
    assertNoArgs(args)
    return localStorage.getArcadeProfile()
  })
  register('arcade:save-profile', (value) => localStorage.saveArcadeProfile(value))
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
  register('settings:save', (value) => {
    const settings = validateSettings(value)
    const savedSettings = localStorage.saveSettings(settings)
    if ('telemetryEnabled' in settings) setTelemetryEnabled(savedSettings.telemetryEnabled)
    if ('username' in settings) {
      void reportUserPresence().catch((error: unknown) => {
        console.warn('Der App-Name konnte nicht beim Vexlor-Dienst registriert werden:', error)
      })
    }
    return savedSettings
  })
  register('settings:autostart', (value) => {
    assertRecord(value)
    if (typeof value.enabled !== 'boolean') throw new Error('Ungültige Autostart-Einstellung.')
    app.setLoginItemSettings({ openAtLogin: value.enabled })
    return localStorage.saveSettings({ launchAtLogin: value.enabled })
  })
  register('settings:reset', (...args) => {
    assertNoArgs(args)
    app.setLoginItemSettings({ openAtLogin: false })
    setTelemetryEnabled(false)
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
    return downloadLatestInstaller(revokeAdminSessionForUpdate)
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
  register('admin:request', (value, ...args) => {
    assertNoArgs(args)
    return requestAdminApi(value)
  })
  register('tickets:has-identity', (...args) => {
    assertNoArgs(args)
    if (!safeStorage.isEncryptionAvailable()) return false
    return hasTicketIdentity()
  })
  register('tickets:request', (value, ...args) => {
    assertNoArgs(args)
    return requestTicketApi(value)
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

app.whenReady().then(async () => {
  const sessionFromPreviousVersion = restoreAdminSession()
  if (sessionFromPreviousVersion) await revokeAdminSessionForUpdate()
  Menu.setApplicationMenu(null)
  registerIpcHandlers()
  registerScreenshotOverlayEvents()
  registerTimerWidgetEvents()
  registerTelemetryLifecycle(localStorage.getSettings().telemetryEnabled)
  createWindow()
  startUserPresence()
  initializeScreenshotShortcut()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (userPresenceTimer) clearInterval(userPresenceTimer)
  userPresenceTimer = null
})
