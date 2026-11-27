import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { createArcadeProfile, validateArcadeProfile as validateArcadeProfileData } from '../../src/services/arcade-profile.mjs'
import { createDefaultCustomization } from '../../src/services/customization.mjs'
import type { ArcadeProfile, AppSettings, CustomizationSettings, GameEntry } from '../../src/types/app'

interface LocalData {
  games: GameEntry[]
  settings: AppSettings
  notes: string
  arcade: ArcadeProfile
}

const defaultSettings: AppSettings = {
  username: '',
  accent: '#428bff',
  theme: 'navy',
  animations: true,
  compactSidebar: false,
  backgroundData: null,
  customization: createDefaultCustomization(),
  notifications: true,
  launchAtLogin: false,
  autoCheckUpdates: true,
  telemetryEnabled: true,
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
  return createArcadeProfile()
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
    arcade: value.arcade === undefined ? emptyArcadeProfile() : validateArcadeProfileData(value.arcade),
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
    data.arcade = validateArcadeProfileData(profile)
    writeData(data)
    return data.arcade
  },

  getSettings: () => readData().settings,

  saveSettings(settings: Partial<AppSettings>): AppSettings {
    const data = readData()
    if ('username' in settings) {
      if (data.settings.username.trim()) {
        throw new Error('Der Nutzername wurde bereits festgelegt und kann nicht geändert werden.')
      }
      const username = settings.username?.trim() ?? ''
      if (!username) throw new Error('Bitte gib einen Nutzernamen ein.')
      data.settings = { ...data.settings, ...settings, username }
      writeData(data)
      return data.settings
    }

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
