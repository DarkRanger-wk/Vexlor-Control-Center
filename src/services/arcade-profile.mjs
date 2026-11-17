export const ARCADE_GAMES = ['space-shooter', 'runner', 'clicker', 'puzzle']

export const ARCADE_ACHIEVEMENTS = [
  { id: 'first-flight', title: 'Erster Start', description: 'Starte deine erste Runde.', icon: 'launch' },
  { id: 'score-500', title: 'Anfänger', description: 'Erreiche 500 Punkte in einer Runde.', icon: 'target' },
  { id: 'score-2000', title: 'Fortgeschritten', description: 'Erreiche 2.000 Punkte in einer Runde.', icon: 'bolt' },
  { id: 'score-5000', title: 'Profi', description: 'Erreiche 5.000 Punkte in einer Runde.', icon: 'crown' },
  { id: 'play-60', title: 'Arcade-Fan', description: 'Spiele insgesamt 60 Minuten.', icon: 'clock' },
]

const achievementIds = new Set(ARCADE_ACHIEVEMENTS.map((achievement) => achievement.id))
const storageKey = 'vcc.arcade.profile.v1'

export function createArcadeProfile() {
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

function isCounter(value) {
  return Number.isSafeInteger(value) && value >= 0
}

function isTile(value) {
  return value === 0 || (isCounter(value) && value <= 2 ** 52 && Number.isInteger(Math.log2(value)))
}

export function validateArcadeProfile(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Das Arcade-Profil hat ein ungültiges Format.')
  }
  const profile = value
  const defaults = createArcadeProfile()
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
  if (profile.recentGames.some((id) => typeof id !== 'string' || !ARCADE_GAMES.includes(id))) {
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

export function applyArcadeAchievements(profile) {
  const unlocked = new Set(profile.achievements)
  if (profile.roundsPlayed > 0) unlocked.add('first-flight')
  if (profile.highScore >= 500) unlocked.add('score-500')
  if (profile.highScore >= 2000) unlocked.add('score-2000')
  if (profile.highScore >= 5000) unlocked.add('score-5000')
  if (profile.totalPlayTimeSeconds >= 3600) unlocked.add('play-60')
  return { ...profile, achievements: [...unlocked] }
}

export function beginArcadeRound(profile, gameId = 'space-shooter') {
  if (!ARCADE_GAMES.includes(gameId)) throw new Error('Unbekanntes Arcade-Spiel.')
  const recentGames = [gameId, ...profile.recentGames.filter((id) => id !== gameId)].slice(0, 8)
  return applyArcadeAchievements({
    ...profile,
    roundsPlayed: profile.roundsPlayed + 1,
    runnerRuns: profile.runnerRuns + Number(gameId === 'runner'),
    puzzle: gameId === 'puzzle'
      ? { ...profile.puzzle, gamesPlayed: profile.puzzle.gamesPlayed + 1, won: false, gameOver: false }
      : profile.puzzle,
    recentGames,
  })
}

export function addArcadePlayTime(profile, seconds) {
  if (!isCounter(seconds)) throw new Error('Die Arcade-Spielzeit muss eine positive ganze Zahl sein.')
  return applyArcadeAchievements({ ...profile, totalPlayTimeSeconds: profile.totalPlayTimeSeconds + seconds })
}

export function completeArcadeRound(profile, score, unsavedSeconds = 0, gameId = 'space-shooter') {
  if (!isCounter(score) || !isCounter(unsavedSeconds)) {
    throw new Error('Punktzahl und Spielzeit müssen positive ganze Zahlen sein.')
  }
  if (gameId !== 'space-shooter' && gameId !== 'runner') throw new Error('Unbekanntes Arcade-Spiel.')
  return applyArcadeAchievements({
    ...profile,
    highScore: gameId === 'space-shooter' ? Math.max(profile.highScore, score) : profile.highScore,
    lastScore: gameId === 'space-shooter' ? score : profile.lastScore,
    runnerBestScore: gameId === 'runner' ? Math.max(profile.runnerBestScore, score) : profile.runnerBestScore,
    totalPlayTimeSeconds: profile.totalPlayTimeSeconds + unsavedSeconds,
  })
}

export function recordPuzzleProgress(profile, state) {
  if (!Array.isArray(state.board)
    || state.board.length !== 16
    || state.board.some((tile) => !isTile(tile))
    || !isCounter(state.score)
    || !isCounter(state.moves)
    || typeof state.won !== 'boolean'
    || typeof state.gameOver !== 'boolean'
    || typeof state.active !== 'boolean') {
    throw new Error('Der Puzzle-Spielstand enthält ungültige Werte.')
  }
  const bestTile = Math.max(0, ...state.board)
  const puzzle = profile.puzzle
  return {
    ...profile,
    puzzle: {
      ...puzzle,
      board: [...state.board],
      score: state.score,
      bestScore: Math.max(puzzle.bestScore, state.score),
      bestTile: Math.max(puzzle.bestTile, bestTile),
      wins: puzzle.wins + Number(state.won && !puzzle.won),
      moves: state.moves,
      won: state.won,
      gameOver: state.gameOver,
      active: state.active,
    },
  }
}

export function loadArcadeProfile(storage = window.localStorage) {
  let serialized
  try {
    serialized = storage.getItem(storageKey)
  } catch (error) {
    throw new Error('Das lokale Arcade-Profil konnte nicht gelesen werden.', { cause: error })
  }
  if (serialized === null) return createArcadeProfile()

  let parsed
  try {
    parsed = JSON.parse(serialized)
  } catch (error) {
    throw new Error('Das lokale Arcade-Profil ist beschädigt und konnte nicht gelesen werden.', { cause: error })
  }
  return validateArcadeProfile(parsed)
}

export function saveArcadeProfile(profile, storage = window.localStorage) {
  const validated = validateArcadeProfile(profile)
  try {
    storage.setItem(storageKey, JSON.stringify(validated))
  } catch (error) {
    throw new Error('Das lokale Arcade-Profil konnte nicht gespeichert werden.', { cause: error })
  }
  return validated
}
