export const ARCADE_GAMES = [
  'space-shooter', 'runner', 'clicker', 'puzzle',
  'snake', 'memory', 'minesweeper', 'tic-tac-toe',
  'pong', 'breakout', 'flappy', 'doodle-jump', 'bubble-shooter', 'neon-racer', 'whack-a-mole', 'reaction-time', 'aim-trainer',
  'stack-tower', 'tetris', 'word-scramble', 'word-guess', 'lights-out', 'sudoku', 'sokoban', 'maze-runner',
  'tower-of-hanoi', 'number-slide', 'connect-four', 'chess', 'battleship', 'reversi', 'checkers', 'mastermind', 'simon-says',
  'quick-math', 'typing-speed', 'color-match', 'rock-paper-scissors',
  'quiz-challenge', 'geography-quiz', 'flag-quiz',
]

export const ARCADE_ACHIEVEMENTS = [
  { id: 'first-flight', title: 'Erster Start', description: 'Starte deine erste Runde.', icon: 'launch' },
  { id: 'score-500', title: 'Anfänger', description: 'Erreiche 500 Punkte in einer Runde.', icon: 'target' },
  { id: 'score-2000', title: 'Fortgeschritten', description: 'Erreiche 2.000 Punkte in einer Runde.', icon: 'bolt' },
  { id: 'score-5000', title: 'Profi', description: 'Erreiche 5.000 Punkte in einer Runde.', icon: 'crown' },
  { id: 'play-60', title: 'Arcade-Fan', description: 'Spiele insgesamt 60 Minuten.', icon: 'clock' },
  ...ARCADE_GAMES.map((gameId) => {
    const gameName = gameId.split('-').map((part) => `${part[0].toUpperCase()}${part.slice(1)}`).join(' ')
    return {
      id: `game-${gameId}`,
      title: `Erste Runde: ${gameName}`,
      description: `Starte deine erste Runde in ${gameName}.`,
      icon: 'crown',
    }
  }),
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
    favorites: [],
    gameRecords: Object.fromEntries(ARCADE_GAMES.map((gameId) => [gameId, { bestScore: 0, roundsPlayed: 0, wins: 0 }])),
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
  const favorites = profile.favorites ?? defaults.favorites
  const suppliedRecords = profile.gameRecords ?? defaults.gameRecords
  if (!isCounter(profile.highScore)
    || (profile.lastScore !== null && !isCounter(profile.lastScore))
    || !isCounter(profile.roundsPlayed)
    || !isCounter(profile.totalPlayTimeSeconds)
    || !isCounter(profile.runnerBestScore ?? 0)
    || !isCounter(profile.runnerRuns ?? 0)
    || !Array.isArray(profile.achievements)
    || !Array.isArray(profile.recentGames)
    || !Array.isArray(favorites)
    || typeof suppliedRecords !== 'object'
    || suppliedRecords === null
    || Array.isArray(suppliedRecords)
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
  if (favorites.some((id) => typeof id !== 'string' || !ARCADE_GAMES.includes(id))) {
    throw new Error('Das Arcade-Profil enthält ein unbekanntes Lieblingsspiel.')
  }
  const gameRecords = Object.fromEntries(ARCADE_GAMES.map((gameId) => {
    const record = suppliedRecords[gameId] ?? defaults.gameRecords[gameId]
    if (typeof record !== 'object' || record === null || Array.isArray(record)
      || !isCounter(record.bestScore)
      || !isCounter(record.roundsPlayed)
      || !isCounter(record.wins)
      || record.wins > record.roundsPlayed) {
      throw new Error('Das Arcade-Profil enthält ungültige Spielstatistiken.')
    }
    return [gameId, { bestScore: record.bestScore, roundsPlayed: record.roundsPlayed, wins: record.wins }]
  }))
  gameRecords['space-shooter'].bestScore = Math.max(gameRecords['space-shooter'].bestScore, profile.highScore)
  gameRecords.runner.bestScore = Math.max(gameRecords.runner.bestScore, profile.runnerBestScore ?? 0)
  gameRecords.puzzle.bestScore = Math.max(gameRecords.puzzle.bestScore, puzzle.bestScore)
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
    favorites: [...new Set(favorites)],
    gameRecords,
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
  for (const gameId of ARCADE_GAMES) {
    if (profile.gameRecords?.[gameId]?.roundsPlayed > 0) unlocked.add(`game-${gameId}`)
  }
  return { ...profile, achievements: [...unlocked] }
}

export function beginArcadeRound(profile, gameId = 'space-shooter') {
  if (!ARCADE_GAMES.includes(gameId)) throw new Error('Unbekanntes Arcade-Spiel.')
  const recentGames = [gameId, ...profile.recentGames.filter((id) => id !== gameId)].slice(0, 8)
  const gameRecords = {
    ...profile.gameRecords,
    [gameId]: { ...profile.gameRecords[gameId], roundsPlayed: profile.gameRecords[gameId].roundsPlayed + 1 },
  }
  return applyArcadeAchievements({
    ...profile,
    roundsPlayed: profile.roundsPlayed + 1,
    runnerRuns: profile.runnerRuns + Number(gameId === 'runner'),
    gameRecords,
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

export function toggleArcadeFavorite(profile, gameId) {
  if (!ARCADE_GAMES.includes(gameId)) throw new Error('Unbekanntes Arcade-Spiel.')
  const favorites = profile.favorites.includes(gameId)
    ? profile.favorites.filter((favorite) => favorite !== gameId)
    : [...profile.favorites, gameId]
  return { ...profile, favorites }
}

export function completeArcadeRound(profile, score, unsavedSeconds = 0, gameId = 'space-shooter', won = false) {
  if (!isCounter(score) || !isCounter(unsavedSeconds)) {
    throw new Error('Punktzahl und Spielzeit müssen positive ganze Zahlen sein.')
  }
  if (!ARCADE_GAMES.includes(gameId) || typeof won !== 'boolean') throw new Error('Unbekanntes Arcade-Spiel.')
  const previousRecord = profile.gameRecords[gameId]
  const gameRecords = {
    ...profile.gameRecords,
    [gameId]: {
      ...previousRecord,
      bestScore: Math.max(previousRecord.bestScore, score),
      wins: previousRecord.wins + Number(won),
    },
  }
  return applyArcadeAchievements({
    ...profile,
    highScore: gameId === 'space-shooter' ? Math.max(profile.highScore, score) : profile.highScore,
    lastScore: gameId === 'space-shooter' ? score : profile.lastScore,
    runnerBestScore: gameId === 'runner' ? Math.max(profile.runnerBestScore, score) : profile.runnerBestScore,
    totalPlayTimeSeconds: profile.totalPlayTimeSeconds + unsavedSeconds,
    gameRecords,
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
  return applyArcadeAchievements({
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
    gameRecords: {
      ...profile.gameRecords,
      puzzle: {
        ...profile.gameRecords.puzzle,
        bestScore: Math.max(profile.gameRecords.puzzle.bestScore, state.score),
        wins: profile.gameRecords.puzzle.wins + Number(state.won && !puzzle.won),
      },
    },
  })
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
