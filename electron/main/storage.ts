import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import type { AppSettings, GameEntry } from '../../src/types/app'

interface LocalData {
  games: GameEntry[]
  settings: AppSettings
  notes: string
}

const defaultSettings: AppSettings = {
  accent: '#428bff',
  theme: 'navy',
  animations: true,
  compactSidebar: false,
  backgroundData: null,
  notifications: true,
  launchAtLogin: false,
  autoCheckUpdates: true,
  screenshotShortcut: 'Super+Shift+S',
}

const emptyData = (): LocalData => ({
  games: [],
  settings: { ...defaultSettings },
  notes: '',
})

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

  return {
    games: value.games as GameEntry[],
    settings: { ...defaultSettings, ...savedSettings },
    notes: value.notes,
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
