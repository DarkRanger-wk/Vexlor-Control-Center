import assert from 'node:assert/strict'
import test from 'node:test'
import { RUNNER_GROUND, advanceRunner, createRunnerState } from './runner-engine.mjs'

test('runner jump clears an obstacle and increases distance score', () => {
  const state = createRunnerState()
  state.spawnTimer = 100
  state.tokenTimer = 100
  state.obstacles.push({ id: 1, x: 200, y: RUNNER_GROUND - 40, width: 28, height: 40 })

  for (let index = 0; index < 8; index += 1) {
    advanceRunner(state, { jump: true }, 0.05, () => 0.99)
  }
  assert.ok(state.player.y < RUNNER_GROUND - state.player.height)
  assert.equal(state.status, 'playing')
  assert.ok(state.score > 0)
})

test('runner collision ends the run and awards collected token points', () => {
  const state = createRunnerState()
  state.spawnTimer = 100
  state.tokenTimer = 100
  state.collected = 2
  state.obstacles.push({ id: 1, x: 112, y: RUNNER_GROUND - 38, width: 30, height: 38 })

  advanceRunner(state, {}, 0.02, () => 0.99)
  assert.equal(state.status, 'gameover')
  assert.ok(state.score >= 150)
  assert.ok(state.events.includes('crash'))
})

test('runner slide lowers the player hitbox while grounded', () => {
  const state = createRunnerState()
  state.spawnTimer = 100
  state.tokenTimer = 100

  advanceRunner(state, { slide: true }, 0.02, () => 0.99)
  assert.equal(state.player.height, 22)
  assert.equal(state.player.grounded, true)
})
