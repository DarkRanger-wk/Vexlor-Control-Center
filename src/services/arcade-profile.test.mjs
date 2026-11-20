import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ARCADE_GAMES,
  addArcadePlayTime,
  applyArcadeAchievements,
  beginArcadeRound,
  completeArcadeRound,
  createArcadeProfile,
  loadArcadeProfile,
  recordPuzzleProgress,
  saveArcadeProfile,
  toggleArcadeFavorite,
  validateArcadeProfile,
} from './arcade-profile.mjs'

function createStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

test('arcade profile persists across reloads', () => {
  const storage = createStorage()
  const defaults = createArcadeProfile()
  const profile = {
    ...defaults,
    highScore: 650,
    lastScore: 650,
    roundsPlayed: 2,
    recentGames: ['space-shooter'],
    gameRecords: { ...defaults.gameRecords, 'space-shooter': { ...defaults.gameRecords['space-shooter'], bestScore: 650 } },
  }
  saveArcadeProfile(profile, storage)
  assert.deepEqual(loadArcadeProfile(storage), profile)
})

test('achievements unlock from score, playtime, and first launch', () => {
  const profile = {
    ...createArcadeProfile(),
    highScore: 5000,
    roundsPlayed: 1,
    totalPlayTimeSeconds: 3600,
  }
  assert.deepEqual(new Set(applyArcadeAchievements(profile).achievements), new Set([
    'first-flight', 'score-500', 'score-2000', 'score-5000', 'play-60',
  ]))
})

test('round results preserve the personal record and update lifetime statistics', () => {
  const started = beginArcadeRound(createArcadeProfile())
  const firstResult = completeArcadeRound(started, 520, 14)
  const secondRound = beginArcadeRound(firstResult)
  const secondResult = completeArcadeRound(secondRound, 200, 8)
  const timed = addArcadePlayTime(secondResult, 10)

  assert.equal(timed.highScore, 520)
  assert.equal(timed.lastScore, 200)
  assert.equal(timed.roundsPlayed, 2)
  assert.equal(timed.totalPlayTimeSeconds, 32)
  assert.ok(timed.achievements.includes('score-500'))
})

test('legacy profiles migrate and rounds update the selected game statistics', () => {
  const legacy = {
    highScore: 18,
    lastScore: 18,
    roundsPlayed: 1,
    totalPlayTimeSeconds: 30,
    achievements: ['first-flight'],
    recentGames: ['space-shooter'],
    soundVolume: 0.35,
  }
  const migrated = validateArcadeProfile(legacy)
  assert.equal(migrated.runnerBestScore, 0)
  assert.equal(migrated.clicker.energy, 0)
  assert.equal(migrated.puzzle.board.length, 16)

  const runner = beginArcadeRound(migrated, 'runner')
  const finishedRunner = completeArcadeRound(runner, 720, 5, 'runner')
  assert.equal(finishedRunner.runnerBestScore, 720)
  assert.equal(finishedRunner.highScore, 18)
  assert.equal(finishedRunner.runnerRuns, 1)

  const puzzleRound = beginArcadeRound(finishedRunner, 'puzzle')
  const solved = recordPuzzleProgress(puzzleRound, {
    board: [2048, ...Array(15).fill(0)],
    score: 4096,
    moves: 12,
    won: true,
    gameOver: false,
    active: true,
  })
  assert.equal(solved.puzzle.bestTile, 2048)
  assert.equal(solved.puzzle.wins, 1)
  assert.equal(solved.puzzle.gamesPlayed, 1)
})

test('new game records and favorites persist with per-game round and win counts', () => {
  const started = beginArcadeRound(createArcadeProfile(), 'minesweeper')
  const finished = completeArcadeRound(started, 875, 18, 'minesweeper', true)
  const favorited = toggleArcadeFavorite(finished, 'minesweeper')
  const storage = createStorage()

  assert.deepEqual(favorited.favorites, ['minesweeper'])
  assert.deepEqual(favorited.gameRecords.minesweeper, { bestScore: 875, roundsPlayed: 1, wins: 1 })
  saveArcadeProfile(favorited, storage)
  assert.deepEqual(loadArcadeProfile(storage), favorited)

  const removed = toggleArcadeFavorite(favorited, 'minesweeper')
  assert.deepEqual(removed.favorites, [])
  assert.throws(() => toggleArcadeFavorite(favorited, 'not-a-game'), /Unbekanntes Arcade-Spiel/)
})

test('all requested minigames are registered and their results persist independently', () => {
  const requestedGames = [
    'snake', 'pong', 'breakout', 'flappy', 'doodle-jump', 'whack-a-mole', 'reaction-time',
    'aim-trainer', 'stack-tower', 'bubble-shooter', 'runner', 'neon-racer', 'puzzle',
    'minesweeper', 'memory', 'sudoku', 'tetris', 'word-scramble', 'word-guess', 'lights-out',
    'sokoban', 'maze-runner', 'tower-of-hanoi', 'number-slide', 'tic-tac-toe', 'connect-four',
    'chess', 'checkers', 'reversi', 'battleship', 'mastermind', 'simon-says', 'quick-math',
    'typing-speed', 'color-match', 'quiz-challenge', 'geography-quiz', 'flag-quiz', 'rock-paper-scissors',
  ]
  assert.equal(requestedGames.length, 39)
  assert.ok(requestedGames.every((gameId) => ARCADE_GAMES.includes(gameId)))

  const records = requestedGames.reduce((profile, gameId) => {
    const started = beginArcadeRound(profile, gameId)
    return completeArcadeRound(started, 25, 2, gameId, true)
  }, createArcadeProfile())
  const validated = validateArcadeProfile(records)
  assert.equal(validated.roundsPlayed, 39)
  assert.equal(validated.totalPlayTimeSeconds, 78)
  assert.ok(requestedGames.every((gameId) => validated.gameRecords[gameId].roundsPlayed === 1))
  assert.ok(requestedGames.every((gameId) => validated.gameRecords[gameId].wins === 1))
})

test('invalid profile values and corrupted saved data are reported', () => {
  assert.throws(() => validateArcadeProfile({ ...createArcadeProfile(), soundVolume: 2 }), /ungültige Werte/)
  assert.throws(() => validateArcadeProfile({ ...createArcadeProfile(), recentGames: ['unknown'] }), /unbekanntes Spiel/)
  assert.throws(() => loadArcadeProfile({ getItem: () => '{' }), /beschädigt/)
})
