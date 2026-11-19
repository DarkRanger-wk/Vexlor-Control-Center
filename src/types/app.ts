export interface GameEntry {
  id: string
  name: string
  description: string
  category: string
  executablePath: string
  coverData: string | null
  favorite: boolean
  lastLaunchedAt: string | null
}

export type ArcadeGameId = 'space-shooter' | 'runner' | 'clicker' | 'puzzle'
export type ArcadeAchievementId = 'first-flight' | 'score-500' | 'score-2000' | 'score-5000' | 'play-60'

export interface ArcadeProfile {
  highScore: number
  lastScore: number | null
  roundsPlayed: number
  totalPlayTimeSeconds: number
  runnerBestScore: number
  runnerRuns: number
  clicker: {
    energy: number
    lifetimeEnergy: number
    upgrades: number
    generators: number
  }
  puzzle: {
    board: number[]
    score: number
    bestScore: number
    bestTile: number
    gamesPlayed: number
    wins: number
    moves: number
    won: boolean
    gameOver: boolean
    active: boolean
  }
  achievements: ArcadeAchievementId[]
  recentGames: ArcadeGameId[]
  soundVolume: number
}

export interface AppSettings {
  accent: string
  theme: 'navy' | 'midnight' | 'graphite'
  animations: boolean
  compactSidebar: boolean
  backgroundData: string | null
  customization: CustomizationSettings
  notifications: boolean
  launchAtLogin: boolean
  autoCheckUpdates: boolean
  telemetryEnabled: boolean
  screenshotShortcut: string
  gamingProfileName: string
  gameSoundEnabled: boolean
  gameSoundVolume: number
  dashboardElements: {
    systemStats: boolean
    systemOverview: boolean
    library: boolean
    arcade: boolean
    quickActions: boolean
  }
}

export interface CustomizationColors {
  accent: string
  background: string
  sidebar: string
  card: string
  menu: string
  button: string
  border: string
  text: string
  muted: string
}

export interface CustomizationValues {
  themeId: string
  colors: CustomizationColors
  background: {
    mode: 'solid' | 'gradient' | 'image'
    gradientStart: string
    gradientEnd: string
    imageData: string | null
    blur: number
    opacity: number
  }
  layout: {
    sidebarWidth: number
    compactSidebar: boolean
    fontSize: number
    fontFamily: string
    radius: number
    transparency: number
    shadows: boolean
    glow: boolean
    animations: boolean
    animationSpeed: number
    sidebarIcons: Record<string, string>
  }
}

export interface CustomizationProfile {
  id: string
  name: string
  values: CustomizationValues
}

export interface CustomizationTheme {
  id: string
  name: string
  values: CustomizationValues
}

export interface CustomizationPalette {
  id: string
  name: string
  colors: CustomizationColors
}

export interface CustomizationSettings {
  activeProfileId: string
  values: CustomizationValues
  profiles: CustomizationProfile[]
  themes: CustomizationTheme[]
  palettes: CustomizationPalette[]
}

export interface ScreenshotDisplay {
  id: string
  label: string
  primary: boolean
}

export interface ScreenshotWindow {
  id: string
  title: string
  thumbnail: string
}

export interface ScreenshotShortcutStatus {
  shortcut: string
  registered: boolean
}

export interface TimerWidgetState {
  timer: {
    status: 'idle' | 'running' | 'paused' | 'completed'
    remainingMs: number
    deadline: number | null
  }
  stopwatch: {
    running: boolean
    elapsedMs: number
    startedAt: number | null
  }
}

export type TimerWidgetAction = 'open-app' | 'timer-toggle' | 'timer-reset' | 'stopwatch-toggle' | 'stopwatch-reset'

export interface ProcessEntry {
  pid: number
  name: string
  cpuPercent: number | null
  memoryBytes: number
}

export interface DiskInfo {
  mount: string
  totalBytes: number
  freeBytes: number
}

export interface SystemSnapshot {
  cpu: {
    model: string
    logicalCores: number
    usagePercent: number | null
  }
  memory: {
    totalBytes: number
    usedBytes: number
    usagePercent: number | null
  }
  gpus: string[]
  operatingSystem: {
    name: string
    version: string
    architecture: string
  }
  disks: DiskInfo[]
  sampledAt: string
  appVersion: string
}

export interface NetworkSnapshot {
  connected: boolean
  adapterName: string | null
  connectionType: string | null
  localAddresses: string[]
  downloadBytesPerSecond: number | null
  uploadBytesPerSecond: number | null
  sampledAt: string
}

export interface UpdateInfo {
  currentVersion: string
  latestVersion: string | null
  updateAvailable: boolean
  releaseUrl: string | null
  downloadUrl: string | null
  installerName: string | null
  notes: string
  publishedAt: string | null
}

export interface VccApi {
  adminRequest(path: string, options?: { method?: 'GET' | 'POST'; body?: string }): Promise<{
    status: number
    body: Record<string, unknown>
  }>
  getSystemSnapshot(): Promise<SystemSnapshot>
  listProcesses(): Promise<ProcessEntry[]>
  getNetworkSnapshot(): Promise<NetworkSnapshot>
  listGames(): Promise<GameEntry[]>
  saveGame(game: Omit<GameEntry, 'lastLaunchedAt'> & { lastLaunchedAt?: string | null }): Promise<GameEntry[]>
  removeGame(id: string): Promise<GameEntry[]>
  launchGame(id: string): Promise<void>
  getArcadeProfile(): Promise<ArcadeProfile>
  saveArcadeProfile(profile: ArcadeProfile): Promise<ArcadeProfile>
  chooseExecutable(): Promise<string | null>
  chooseCover(): Promise<string | null>
  chooseBackground(): Promise<string | null>
  getSettings(): Promise<AppSettings>
  saveSettings(settings: Partial<AppSettings>): Promise<AppSettings>
  setAutostart(enabled: boolean): Promise<AppSettings>
  resetLocalData(): Promise<void>
  getNotes(): Promise<string>
  saveNotes(notes: string): Promise<void>
  checkUpdates(): Promise<UpdateInfo>
  openRelease(tag: string): Promise<void>
  downloadUpdate(): Promise<UpdateInfo>
  listScreenshotDisplays(): Promise<ScreenshotDisplay[]>
  listScreenshotWindows(): Promise<ScreenshotWindow[]>
  captureScreenshotDisplay(displayId: string): Promise<string>
  captureScreenshotWindow(sourceId: string): Promise<string>
  captureScreenshotRegion(): Promise<string | null>
  saveScreenshot(imageDataUrl: string): Promise<boolean>
  copyScreenshot(imageDataUrl: string): Promise<void>
  getScreenshotShortcut(): Promise<ScreenshotShortcutStatus>
  setScreenshotShortcut(shortcut: string): Promise<ScreenshotShortcutStatus>
  onScreenshotCaptured(callback: (imageDataUrl: string) => void): () => void
  onScreenshotError(callback: (message: string) => void): () => void
  updateTimerWidget(state: TimerWidgetState): Promise<void>
  onTimerWidgetAction(callback: (action: TimerWidgetAction) => void): () => void
  openEmail(): Promise<void>
  minimizeWindow(): Promise<void>
  toggleMaximizeWindow(): Promise<void>
  closeWindow(): Promise<void>
}
