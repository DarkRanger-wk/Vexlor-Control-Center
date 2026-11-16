import assert from 'node:assert/strict'
import test from 'node:test'
import { scaleScreenshotRectangle } from './screenshot.ts'

test('scales a selected region to the display capture resolution', () => {
  assert.deepEqual(
    scaleScreenshotRectangle(
      { x: 20, y: 30, width: 100, height: 50 },
      { width: 800, height: 600 },
      { width: 1600, height: 1200 },
    ),
    { x: 40, y: 60, width: 200, height: 100 },
  )
})

test('clips a selected region to the content bounds', () => {
  assert.deepEqual(
    scaleScreenshotRectangle(
      { x: 90, y: 70, width: 30, height: 50 },
      { width: 100, height: 80 },
      { width: 150, height: 120 },
    ),
    { x: 135, y: 105, width: 15, height: 15 },
  )
})

test('rejects empty or invalid screenshot regions', () => {
  assert.throws(
    () => scaleScreenshotRectangle(
      { x: 0, y: 0, width: 0, height: 10 },
      { width: 100, height: 100 },
      { width: 100, height: 100 },
    ),
    /Ungültiger Screenshot-Bereich/,
  )
})
