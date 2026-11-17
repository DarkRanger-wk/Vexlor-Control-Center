export const GAME_WIDTH = 960
export const GAME_HEIGHT = 540

const enemyProperties = {
  scout: { health: 1, radius: 14, points: 120, speed: 90 },
  weaver: { health: 1, radius: 15, points: 180, speed: 105 },
  brute: { health: 3, radius: 22, points: 320, speed: 66 },
  asteroid: { health: 2, radius: 19, points: 160, speed: 78 },
}

export function createGameState() {
  return {
    elapsed: 0,
    savedSeconds: 0,
    score: 0,
    difficulty: 1,
    status: 'playing',
    spawnTimer: 0,
    player: {
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT - 68,
      radius: 14,
      health: 3,
      maxHealth: 3,
      fireCooldown: 0,
      invulnerable: 0,
      shieldUntil: 0,
      rapidUntil: 0,
    },
    bullets: [],
    enemies: [],
    powerUps: [],
    events: [],
    nextEntityId: 1,
  }
}

function spawnEnemy(state, random) {
  const roll = random()
  let type = 'scout'
  if (state.difficulty >= 1.5 && roll >= 0.48 && roll < 0.72) type = 'weaver'
  else if (state.difficulty >= 2 && roll >= 0.72 && roll < 0.9) type = 'brute'
  else if (state.difficulty >= 2.5 && roll >= 0.9) type = 'asteroid'

  const properties = enemyProperties[type]
  state.enemies.push({
    id: state.nextEntityId++,
    type,
    x: 30 + random() * (GAME_WIDTH - 60),
    y: -properties.radius,
    radius: properties.radius,
    health: properties.health,
    points: properties.points,
    speed: properties.speed + Math.min(state.difficulty, 6) * 13 + random() * 22,
    phase: random() * Math.PI * 2,
  })
}

function overlaps(first, second, padding = 0) {
  const radius = first.radius + second.radius + padding
  const dx = first.x - second.x
  const dy = first.y - second.y
  return dx * dx + dy * dy <= radius * radius
}

export function advanceGame(state, input = {}, deltaSeconds = 0, random = Math.random) {
  if (state.status !== 'playing') return state
  const delta = Math.min(Math.max(Number(deltaSeconds) || 0, 0), 0.05)
  if (delta === 0) return state

  state.events = []
  state.elapsed += delta
  state.difficulty = 1 + state.elapsed / 35

  const player = state.player
  player.invulnerable = Math.max(0, player.invulnerable - delta)
  player.fireCooldown = Math.max(0, player.fireCooldown - delta)

  let directionX = Number(Boolean(input.right)) - Number(Boolean(input.left))
  let directionY = Number(Boolean(input.down)) - Number(Boolean(input.up))
  const magnitude = Math.hypot(directionX, directionY) || 1
  directionX /= magnitude
  directionY /= magnitude
  player.x = Math.min(GAME_WIDTH - player.radius, Math.max(player.radius, player.x + directionX * 275 * delta))
  player.y = Math.min(GAME_HEIGHT - player.radius, Math.max(GAME_HEIGHT * 0.42, player.y + directionY * 275 * delta))

  if (input.shoot && player.fireCooldown <= 0) {
    state.bullets.push({ x: player.x, y: player.y - 20, radius: 4, speed: 520 })
    player.fireCooldown = player.rapidUntil > state.elapsed ? 0.11 : 0.23
    state.events.push('shoot')
  }

  state.spawnTimer -= delta
  if (state.spawnTimer <= 0) {
    spawnEnemy(state, random)
    state.spawnTimer = Math.max(0.34, 1.25 - state.elapsed / 90)
  }

  for (const enemy of state.enemies) {
    enemy.y += enemy.speed * delta
    if (enemy.type === 'weaver') enemy.x += Math.sin(state.elapsed * 2.8 + enemy.phase) * enemy.speed * 0.42 * delta
  }

  for (const bullet of state.bullets) bullet.y -= bullet.speed * delta
  state.bullets = state.bullets.filter((bullet) => bullet.y > -12)

  for (const bullet of state.bullets) {
    if (bullet.spent) continue
    const enemy = state.enemies.find((candidate) => !candidate.destroyed && overlaps(bullet, candidate))
    if (!enemy) continue
    bullet.spent = true
    enemy.health -= 1
    if (enemy.health <= 0) {
      enemy.destroyed = true
      state.score += enemy.points
      state.events.push('explosion')
      if (random() < 0.14) {
        const type = random() < 0.4 ? 'repair' : random() < 0.5 ? 'shield' : 'rapid'
        state.powerUps.push({ x: enemy.x, y: enemy.y, radius: 11, type, speed: 95 })
      }
    }
  }
  state.bullets = state.bullets.filter((bullet) => !bullet.spent)
  state.enemies = state.enemies.filter((enemy) => !enemy.destroyed && enemy.y < GAME_HEIGHT + enemy.radius)

  for (const enemy of state.enemies) {
    if (!overlaps(player, enemy) || player.invulnerable > 0) continue
    enemy.destroyed = true
    if (player.shieldUntil > state.elapsed) {
      state.events.push('shield-hit')
      continue
    }
    player.health = Math.max(0, player.health - 1)
    player.invulnerable = 1.15
    state.events.push('hit')
    if (player.health === 0) state.status = 'gameover'
  }
  state.enemies = state.enemies.filter((enemy) => !enemy.destroyed)

  for (const powerUp of state.powerUps) powerUp.y += powerUp.speed * delta
  for (const powerUp of state.powerUps) {
    if (powerUp.collected || !overlaps(player, powerUp, 3)) continue
    powerUp.collected = true
    if (powerUp.type === 'repair') player.health = Math.min(player.maxHealth, player.health + 1)
    if (powerUp.type === 'shield') player.shieldUntil = state.elapsed + 8
    if (powerUp.type === 'rapid') player.rapidUntil = state.elapsed + 8
    state.events.push('powerup')
  }
  state.powerUps = state.powerUps.filter((powerUp) => !powerUp.collected && powerUp.y < GAME_HEIGHT + 20)
  return state
}
