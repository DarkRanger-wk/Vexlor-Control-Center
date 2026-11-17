import assert from 'node:assert/strict'
import test from 'node:test'
import {
  accrueClickerIncome,
  collectClickerEnergy,
  getClickUpgradeCost,
  getClickerPower,
  getGeneratorCost,
  purchaseClickUpgrade,
  purchaseGenerator,
} from './clicker-engine.mjs'

const emptyClicker = { energy: 0, lifetimeEnergy: 0, upgrades: 0, generators: 0 }

test('clicker earns its current power and upgrades increase future clicks', () => {
  const firstClick = collectClickerEnergy(emptyClicker)
  assert.equal(firstClick.energy, 1)
  assert.equal(firstClick.lifetimeEnergy, 1)

  const funded = { ...firstClick, energy: getClickUpgradeCost(0) }
  const upgraded = purchaseClickUpgrade(funded)
  assert.equal(upgraded.upgrades, 1)
  assert.equal(getClickerPower(upgraded), 2)
  assert.equal(collectClickerEnergy(upgraded).energy, upgraded.energy + 2)
})

test('clicker rejects unaffordable purchases without changing progress', () => {
  assert.equal(purchaseClickUpgrade(emptyClicker), emptyClicker)
  assert.equal(purchaseGenerator(emptyClicker), emptyClicker)
})

test('generators accrue energy and lifetime totals without exceeding safe integers', () => {
  const generator = { ...emptyClicker, energy: getGeneratorCost(0), lifetimeEnergy: getGeneratorCost(0) }
  const purchased = purchaseGenerator(generator)
  const accrued = accrueClickerIncome(purchased)
  assert.equal(purchased.generators, 1)
  assert.equal(accrued.energy, purchased.energy + 1)
  assert.equal(accrued.lifetimeEnergy, purchased.lifetimeEnergy + 1)

  const capped = { ...purchased, energy: Number.MAX_SAFE_INTEGER, lifetimeEnergy: Number.MAX_SAFE_INTEGER }
  assert.equal(accrueClickerIncome(capped), capped)
})
