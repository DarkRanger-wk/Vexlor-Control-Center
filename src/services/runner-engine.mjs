export const RUNNER_WIDTH = 900
export const RUNNER_HEIGHT = 340
export const RUNNER_GROUND = 270

export function createRunnerState() {
  return {
    elapsed: 0,
    distance: 0,
    score: 0,
    speed: 270,
    spawnTimer: 0.8,
    tokenTimer: 2,
    status: 'playing',
    obstacles: [],
    tokens: [],
    events: [],
    nextId: 1,
    collected: 0,
    jumpHeld: false,
    player: { x: 112, y: RUNNER_GROUND - 38, width: 30, height: 38, velocityY: 0, grounded: true, sliding: false },
  }
}

function intersects(first, second) {
  return first.x < second.x + second.width
    && first.x + first.width > second.x
    && first.y < second.y + second.height
    && first.y + first.height > second.y
}

function spawnObstacle(state, random) {
  const tall = random() < 0.32
  const width = tall ? 28 : 23 + random() * 18
  const height = tall ? 55 + random() * 22 : 27 + random() * 20
  state.obstacles.push({ id: state.nextId++, x: RUNNER_WIDTH + 10, y: RUNNER_GROUND - height, width, height, tall })
}

export function advanceRunner(state, input = {}, deltaSeconds = 0, random = Math.random) {
  if (state.status !== 'playing') return state
  const delta = Math.min(Math.max(Number(deltaSeconds) || 0, 0), 0.05)
  if (delta === 0) return state

  state.events = []
  state.elapsed += delta
  state.speed = Math.min(650, 270 + state.distance * 0.018)
  state.distance += state.speed * delta / 18
  state.score = Math.floor(state.distance + state.collected * 75)

  const player = state.player
  const wantsJump = Boolean(input.jump)
  if (wantsJump && !state.jumpHeld && player.grounded) {
    player.velocityY = -610
    player.grounded = false
    player.sliding = false
    state.events.push('jump')
  }
  state.jumpHeld = wantsJump
  player.sliding = Boolean(input.slide) && player.grounded
  player.height = player.sliding ? 22 : 38
  player.y = Math.min(player.y, RUNNER_GROUND - player.height)
  if (!player.grounded) {
    player.velocityY += 1650 * delta
    player.y += player.velocityY * delta
    if (player.y >= RUNNER_GROUND - player.height) {
      player.y = RUNNER_GROUND - player.height
      player.velocityY = 0
      player.grounded = true
    }
  }

  state.spawnTimer -= delta
  if (state.spawnTimer <= 0) {
    spawnObstacle(state, random)
    state.spawnTimer = Math.max(0.58, 1.28 - state.distance / 2200) + random() * 0.28
  }
  state.tokenTimer -= delta
  if (state.tokenTimer <= 0) {
    const height = 48 + random() * 50
    state.tokens.push({ id: state.nextId++, x: RUNNER_WIDTH + 10, y: RUNNER_GROUND - height, width: 14, height: 14 })
    state.tokenTimer = 2.2 + random() * 1.6
  }

  for (const obstacle of state.obstacles) obstacle.x -= state.speed * delta
  for (const token of state.tokens) token.x -= state.speed * delta
  const hitbox = { x: player.x + 3, y: player.y + 3, width: player.width - 6, height: player.height - 4 }
  for (const obstacle of state.obstacles) {
    if (intersects(hitbox, obstacle)) {
      state.status = 'gameover'
      state.events.push('crash')
      break
    }
  }
  for (const token of state.tokens) {
    if (!token.collected && intersects(hitbox, token)) {
      token.collected = true
      state.collected += 1
      state.score = Math.floor(state.distance + state.collected * 75)
      state.events.push('collect')
    }
  }
  state.obstacles = state.obstacles.filter((obstacle) => obstacle.x + obstacle.width > -10)
  state.tokens = state.tokens.filter((token) => !token.collected && token.x + token.width > -10)
  return state
}
