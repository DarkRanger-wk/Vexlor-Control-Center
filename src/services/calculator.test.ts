import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateExpression } from './calculator.ts'

test('calculator respects operator precedence and parentheses', () => {
  assert.equal(calculateExpression('1 + 2 * 3'), 7)
  assert.equal(calculateExpression('(1 + 2) * 3'), 9)
  assert.equal(calculateExpression('-(-4 + 1)'), 3)
})

test('calculator rejects invalid expressions and division by zero', () => {
  assert.throws(() => calculateExpression('2 / 0'), /Division durch null/)
  assert.throws(() => calculateExpression('1 + (2'), /Klammer/)
  assert.throws(() => calculateExpression('2 ** 4'), /gültigen/)
})
