import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { createDefaultCustomization } from '../../src/services/customization.mjs'
import type { ArcadeProfile, AppSettings, CustomizationSettings, GameEntry } from '../../src/types/app'

interface LocalData {
  games: GameEntry[]
  settings: AppSettings
  notes: string
  arcade: ArcadeProfile
}

const defaultSettings: AppSettings = {
  accent: '#428bff',
  theme: 'navy',
  animations: true,
  compactSidebar: false,
  backgroundData: null,
  customization: createDefaultCustomization(),
  notifications: true,
  launchAtLogin: false,
  autoCheckUpdates: true,
  telemetryEnabled: false,
  screenshotShortcut: 'Ctrl+Shift+S',
  gamingProfileName: 'Lokales Gaming-Profil',
  gameSoundEnabled: true,
  gameSoundVolume: 0.35,
  dashboardElements: {
    systemStats: true,
    systemOverview: true,
    library: true,
    arcade: true,
    quickActions: true,
  },
}

const emptyData = (): LocalData => ({
  games: [],
  settings: { ...defaultSettings },
  notes: '',
  arcade: emptyArcadeProfile(),
})

function emptyArcadeProfile(): ArcadeProfile {
  return {
    highScore: 0,
    lastScore: null,
    roundsPlayed: 0,
    totalPlayTimeSeconds: 0,
    runnerBestScore: 0,
    runnerRuns: 0,
    clicker: { energy: 0, lifetimeEnergy: 0, upgrades: 0, generators: 0 },
    puzzle: {
      board: Array(16).fill(0),
      score: 0,
      bestScore: 0,
      bestTile: 0,
      gamesPlayed: 0,
      wins: 0,
      moves: 0,
      won: false,
      gameOver: false,
      active: false,
    },
    achievements: [],
    recentGames: [],
    soundVolume: 0.35,
  }
}

function validateArcadeProfile(value: unknown): ArcadeProfile {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Das Arcade-Profil hat ein ungültiges Format.')
  }
  const profile = value as Partial<ArcadeProfile>
  const isCounter = (entry: unknown): entry is number => Number.isSafeInteger(entry) && (entry as number) >= 0
  const isTile = (entry: unknown): entry is number => entry === 0
    || (isCounter(entry) && entry <= 2 ** 52 && Number.isInteger(Math.log2(entry)))
  const achievementIds = new Set(['first-flight', 'score-500', 'score-2000', 'score-5000', 'play-60'])
  const gameIds = new Set(['space-shooter', 'runner', 'clicker', 'puzzle'])
  const defaults = emptyArcadeProfile()
  const clicker = profile.clicker ?? defaults.clicker
  const puzzle = profile.puzzle ?? defaults.puzzle

  if (!isCounter(profile.highScore)
    || (profile.lastScore !== null && !isCounter(profile.lastScore))
    || !isCounter(profile.roundsPlayed)
    || !isCounter(profile.totalPlayTimeSeconds)
    || !isCounter(profile.runnerBestScore ?? 0)
    || !isCounter(profile.runnerRuns ?? 0)
    || !Array.isArray(profile.achievements)
    || !Array.isArray(profile.recentGames)
    || typeof profile.soundVolume !== 'number'
    || !Number.isFinite(profile.soundVolume)
    || profile.soundVolume < 0
    || profile.soundVolume > 1) {
    throw new Error('Das Arcade-Profil enthält ungültige Werte.')
  }
  if (profile.achievements.some((id) => typeof id !== 'string' || !achievementIds.has(id))) {
    throw new Error('Das Arcade-Profil enthält einen unbekannten Erfolg.')
  }
  if (profile.recentGames.some((id) => typeof id !== 'string' || !gameIds.has(id))) {
    throw new Error('Das Arcade-Profil enthält ein unbekanntes Spiel.')
  }
  if (typeof clicker !== 'object' || clicker === null || Array.isArray(clicker)
    || !isCounter(clicker.energy)
    || !isCounter(clicker.lifetimeEnergy)
    || clicker.lifetimeEnergy < clicker.energy
    || !isCounter(clicker.upgrades)
    || clicker.upgrades > 50
    || !isCounter(clicker.generators)
    || clicker.generators > 50) {
    throw new Error('Der Clicker-Spielstand enthält ungültige Werte.')
  }
  if (typeof puzzle !== 'object' || puzzle === null || Array.isArray(puzzle)
    || !Array.isArray(puzzle.board)
    || puzzle.board.length !== 16
    || puzzle.board.some((tile) => !isTile(tile))
    || !isCounter(puzzle.score)
    || !isCounter(puzzle.bestScore)
    || !isTile(puzzle.bestTile)
    || !isCounter(puzzle.gamesPlayed)
    || !isCounter(puzzle.wins)
    || puzzle.wins > puzzle.gamesPlayed
    || !isCounter(puzzle.moves)
    || typeof puzzle.won !== 'boolean'
    || typeof puzzle.gameOver !== 'boolean'
    || typeof puzzle.active !== 'boolean') {
    throw new Error('Der Puzzle-Spielstand enthält ungültige Werte.')
  }

  return {
    highScore: profile.highScore,
    lastScore: profile.lastScore,
    roundsPlayed: profile.roundsPlayed,
    totalPlayTimeSeconds: profile.totalPlayTimeSeconds,
    runnerBestScore: profile.runnerBestScore ?? 0,
    runnerRuns: profile.runnerRuns ?? 0,
    clicker: {
      energy: clicker.energy,
      lifetimeEnergy: clicker.lifetimeEnergy,
      upgrades: clicker.upgrades,
      generators: clicker.generators,
    },
    puzzle: {
      board: [...puzzle.board],
      score: puzzle.score,
      bestScore: puzzle.bestScore,
      bestTile: puzzle.bestTile,
      gamesPlayed: puzzle.gamesPlayed,
      wins: puzzle.wins,
      moves: puzzle.moves,
      won: puzzle.won,
      gameOver: puzzle.gameOver,
      active: puzzle.active,
    },
    achievements: [...new Set(profile.achievements)],
    recentGames: [...new Set(profile.recentGames)].slice(0, 8),
    soundVolume: profile.soundVolume,
  }
}

function dataPath(): string {
  return join(app.getPath('userData'), 'vcc-data.json')
}

function readData(): LocalData {
  const file = dataPath()
  if (!existsSync(file)) return emptyData()

  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'))
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Die lokale VCC-Datendatei hat ein ungültiges Format.')
  }

  const value = parsed as Partial<LocalData>
  if (!Array.isArray(value.games) || typeof value.settings !== 'object' || value.settings === null || typeof value.notes !== 'string') {
    throw new Error('Die lokale VCC-Datendatei ist unvollständig oder beschädigt.')
  }

  const savedSettings = { ...value.settings }
  delete (savedSettings as Partial<AppSettings> & { githubRepository?: unknown }).githubRepository
  const customization = savedSettings.customization ?? migrateCustomization(savedSettings)

  return {
    games: value.games as GameEntry[],
    settings: { ...defaultSettings, ...savedSettings, customization },
    notes: value.notes,
    arcade: value.arcade === undefined ? emptyArcadeProfile() : validateArcadeProfile(value.arcade),
  }
}

function migrateCustomization(settings: Partial<AppSettings>): CustomizationSettings {
  const defaults = createDefaultCustomization()
  const values = defaults.values
  const colors = { ...values.colors }
  if (typeof settings.accent === 'string' && /^#[\da-f]{6}$/i.test(settings.accent)) {
    colors.accent = settings.accent
  }

  const imageData = typeof settings.backgroundData === 'string' ? settings.backgroundData : null
  const migratedValues = {
    ...values,
    colors,
    background: {
      ...values.background,
      imageData,
      mode: imageData ? 'image' as const : values.background.mode,
    },
    layout: {
      ...values.layout,
      animations: settings.animations ?? values.layout.animations,
      compactSidebar: settings.compactSidebar ?? values.layout.compactSidebar,
    },
  }

  return {
    ...defaults,
    values: migratedValues,
    profiles: defaults.profiles.map((profile) => ({ ...profile, values: migratedValues })),
  }
}

function writeData(data: LocalData): void {
  const file = dataPath()
  const tempFile = `${file}.tmp`
  writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8')
  renameSync(tempFile, file)
}

export const localStorage = {
  getGames: () => readData().games,

  saveGame(game: GameEntry): GameEntry[] {
    const data = readData()
    const index = data.games.findIndex((entry) => entry.id === game.id)
    if (index >= 0) data.games[index] = game
    else data.games.push(game)
    writeData(data)
    return data.games
  },

  removeGame(id: string): GameEntry[] {
    const data = readData()
    data.games = data.games.filter((game) => game.id !== id)
    writeData(data)
    return data.games
  },

  getArcadeProfile: () => readData().arcade,

  saveArcadeProfile(profile: unknown): ArcadeProfile {
    const data = readData()
    data.arcade = validateArcadeProfile(profile)
    writeData(data)
    return data.arcade
  },

  getSettings: () => readData().settings,

  saveSettings(settings: Partial<AppSettings>): AppSettings {
    const data = readData()
    data.settings = { ...data.settings, ...settings }
    writeData(data)
    return data.settings
  },

  getNotes: () => readData().notes,

  saveNotes(notes: string): void {
    const data = readData()
    data.notes = notes
    writeData(data)
  },

  reset(): void {
    writeData(emptyData())
  },
}
