export const MAX_CLICKER_LEVEL = 50

export function getClickerPower(clicker) {
  return 1 + clicker.upgrades
}

export function getClickUpgradeCost(level) {
  return Math.floor(18 * 1.55 ** level)
}

export function getGeneratorCost(level) {
  return Math.floor(90 * 1.65 ** level)
}

export function collectClickerEnergy(clicker) {
  const amount = getClickerPower(clicker)
  if (clicker.energy > Number.MAX_SAFE_INTEGER - amount
    || clicker.lifetimeEnergy > Number.MAX_SAFE_INTEGER - amount) return clicker
  return {
    ...clicker,
    energy: clicker.energy + amount,
    lifetimeEnergy: clicker.lifetimeEnergy + amount,
  }
}

export function purchaseClickUpgrade(clicker) {
  const cost = getClickUpgradeCost(clicker.upgrades)
  if (clicker.energy < cost || clicker.upgrades >= MAX_CLICKER_LEVEL) return clicker
  return { ...clicker, energy: clicker.energy - cost, upgrades: clicker.upgrades + 1 }
}

export function purchaseGenerator(clicker) {
  const cost = getGeneratorCost(clicker.generators)
  if (clicker.energy < cost || clicker.generators >= MAX_CLICKER_LEVEL) return clicker
  return { ...clicker, energy: clicker.energy - cost, generators: clicker.generators + 1 }
}

export function accrueClickerIncome(clicker) {
  const amount = Math.min(
    clicker.generators,
    Number.MAX_SAFE_INTEGER - clicker.energy,
    Number.MAX_SAFE_INTEGER - clicker.lifetimeEnergy,
  )
  if (amount <= 0) return clicker
  return {
    ...clicker,
    energy: clicker.energy + amount,
    lifetimeEnergy: clicker.lifetimeEnergy + amount,
  }
}
