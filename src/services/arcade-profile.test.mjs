import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addArcadePlayTime,
  applyArcadeAchievements,
  beginArcadeRound,
  completeArcadeRound,
  createArcadeProfile,
  loadArcadeProfile,
  saveArcadeProfile,
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
  const profile = { ...createArcadeProfile(), highScore: 650, lastScore: 650, roundsPlayed: 2, recentGames: ['space-shooter'] }
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

test('invalid profile values and corrupted saved data are reported', () => {
  assert.throws(() => validateArcadeProfile({ ...createArcadeProfile(), soundVolume: 2 }), /ungültige Werte/)
  assert.throws(() => validateArcadeProfile({ ...createArcadeProfile(), recentGames: ['unknown'] }), /unbekanntes Spiel/)
  assert.throws(() => loadArcadeProfile({ getItem: () => '{' }), /beschädigt/)
})
