import assert from 'node:assert/strict'
import test from 'node:test'
import { GAME_HEIGHT, GAME_WIDTH, advanceGame, createGameState } from './arcade-engine.mjs'

test('player movement is normalized and stays within the playfield', () => {
  const state = createGameState()
  const startX = state.player.x
  advanceGame(state, { right: true, up: true }, 0.05, () => 0)
  assert.ok(state.player.x > startX)
  assert.ok(state.player.y < GAME_HEIGHT - 68)

  for (let index = 0; index < 100; index += 1) advanceGame(state, { right: true, up: true }, 0.05, () => 0)
  assert.ok(state.player.x <= GAME_WIDTH - state.player.radius)
  assert.ok(state.player.y >= GAME_HEIGHT * 0.42)
})

test('shooting creates a projectile and respects its cooldown', () => {
  const state = createGameState()
  state.spawnTimer = 10
  advanceGame(state, { shoot: true }, 0.05, () => 0)
  assert.equal(state.bullets.length, 1)
  assert.deepEqual(state.events, ['shoot'])

  advanceGame(state, { shoot: true }, 0.05, () => 0)
  assert.equal(state.bullets.length, 1)
})

test('destroying an enemy awards points and can drop a power-up', () => {
  const state = createGameState()
  state.spawnTimer = 10
  state.bullets.push({ x: 200, y: 200, radius: 4, speed: 0 })
  state.enemies.push({ x: 200, y: 200, radius: 14, health: 1, points: 120, speed: 0, type: 'scout' })

  advanceGame(state, {}, 0.02, () => 0)
  assert.equal(state.score, 120)
  assert.equal(state.enemies.length, 0)
  assert.equal(state.powerUps.length, 1)
  assert.ok(state.events.includes('explosion'))
})

test('a collision costs one life and grants temporary invulnerability', () => {
  const state = createGameState()
  state.spawnTimer = 10
  state.enemies.push({ x: state.player.x, y: state.player.y, radius: 14, health: 1, points: 120, speed: 0, type: 'scout' })

  advanceGame(state, {}, 0.02, () => 0.99)
  assert.equal(state.player.health, 2)
  assert.equal(state.status, 'playing')
  assert.ok(state.player.invulnerable > 0)
  assert.ok(state.events.includes('hit'))
})

test('a collected power-up activates its effect', () => {
  const state = createGameState()
  state.spawnTimer = 10
  state.player.health = 2
  state.powerUps.push({ x: state.player.x, y: state.player.y, radius: 11, type: 'repair', speed: 0 })

  advanceGame(state, {}, 0.02, () => 0.99)
  assert.equal(state.player.health, 3)
  assert.ok(state.events.includes('powerup'))
})

test('a shield absorbs an enemy collision without costing a life', () => {
  const state = createGameState()
  state.spawnTimer = 10
  state.player.shieldUntil = 10
  state.enemies.push({ x: state.player.x, y: state.player.y, radius: 14, health: 1, points: 120, speed: 0, type: 'scout' })

  advanceGame(state, {}, 0.02, () => 0.99)
  assert.equal(state.player.health, 3)
  assert.equal(state.enemies.length, 0)
  assert.ok(state.events.includes('shield-hit'))
})

test('difficulty increases as a round lasts longer', () => {
  const state = createGameState()
  state.spawnTimer = 100
  for (let index = 0; index < 720; index += 1) advanceGame(state, {}, 0.05, () => 0.99)
  assert.ok(state.elapsed >= 35)
  assert.ok(state.difficulty > 2)
})

test('the game ends when the final life is lost', () => {
  const state = createGameState()
  state.spawnTimer = 10
  state.player.health = 1
  state.enemies.push({ x: state.player.x, y: state.player.y, radius: 14, health: 1, points: 120, speed: 0, type: 'scout' })

  advanceGame(state, {}, 0.02, () => 0.99)
  assert.equal(state.status, 'gameover')
})
