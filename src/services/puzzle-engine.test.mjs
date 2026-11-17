import assert from 'node:assert/strict'
import test from 'node:test'
import { createPuzzleState, movePuzzle } from './puzzle-engine.mjs'

test('puzzle starts with two tiles and merges a pair once per move', () => {
  const initial = createPuzzleState(() => 0)
  assert.equal(initial.board.filter((tile) => tile > 0).length, 2)

  const state = {
    ...initial,
    board: [2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  }
  const moved = movePuzzle(state, 'left', () => 0.99)
  assert.deepEqual(moved.board.slice(0, 4), [4, 4, 0, 0])
  assert.equal(moved.score, 8)
  assert.equal(moved.moves, 1)
})

test('puzzle does not change or spawn a tile for an invalid move', () => {
  const state = {
    ...createPuzzleState(() => 0),
    board: [2, 0, 0, 0, 4, 0, 0, 0, ...Array(8).fill(0)],
  }
  const unchanged = movePuzzle(state, 'left', () => 0.5)
  assert.equal(unchanged, state)
})

test('puzzle unlocks the win tile and marks a full immovable board as game over', () => {
  const winState = {
    board: [1024, 1024, 0, 0, ...Array(12).fill(0)],
    score: 0,
    moves: 0,
    won: false,
    gameOver: false,
    active: true,
  }
  assert.equal(movePuzzle(winState, 'left', () => 0.99).won, true)

  const full = {
    ...winState,
    board: [2, 2, 8, 16, 8, 16, 32, 64, 16, 32, 64, 128, 32, 64, 128, 256],
  }
  assert.equal(movePuzzle(full, 'left', () => 0.99).gameOver, true)
})
