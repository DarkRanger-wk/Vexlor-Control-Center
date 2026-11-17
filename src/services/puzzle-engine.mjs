export const PUZZLE_SIZE = 4
export const PUZZLE_WIN_TILE = 2048

export function createPuzzleState(random = Math.random) {
  const state = {
    board: Array(PUZZLE_SIZE * PUZZLE_SIZE).fill(0),
    score: 0,
    moves: 0,
    won: false,
    gameOver: false,
    active: true,
  }
  spawnTile(state.board, random)
  spawnTile(state.board, random)
  return state
}

function spawnTile(board, random) {
  const empty = []
  for (let index = 0; index < board.length; index += 1) {
    if (board[index] === 0) empty.push(index)
  }
  if (empty.length === 0) return false
  const index = empty[Math.floor(random() * empty.length)]
  board[index] = random() < 0.9 ? 2 : 4
  return true
}

function canMove(board) {
  if (board.some((tile) => tile === 0)) return true
  for (let row = 0; row < PUZZLE_SIZE; row += 1) {
    for (let column = 0; column < PUZZLE_SIZE; column += 1) {
      const tile = board[row * PUZZLE_SIZE + column]
      if (column < PUZZLE_SIZE - 1 && tile === board[row * PUZZLE_SIZE + column + 1]) return true
      if (row < PUZZLE_SIZE - 1 && tile === board[(row + 1) * PUZZLE_SIZE + column]) return true
    }
  }
  return false
}

function lineIndices(direction, line) {
  if (direction === 'left' || direction === 'right') {
    const row = Array.from({ length: PUZZLE_SIZE }, (_, column) => line * PUZZLE_SIZE + column)
    return direction === 'right' ? row.reverse() : row
  }
  const column = Array.from({ length: PUZZLE_SIZE }, (_, row) => row * PUZZLE_SIZE + line)
  return direction === 'down' ? column.reverse() : column
}

export function movePuzzle(state, direction, random = Math.random) {
  if (!['left', 'right', 'up', 'down'].includes(direction)) throw new Error('Unbekannte Puzzle-Richtung.')
  if (!state.active || state.gameOver) return state

  const board = [...state.board]
  let score = state.score
  for (let line = 0; line < PUZZLE_SIZE; line += 1) {
    const indices = lineIndices(direction, line)
    const values = indices.map((index) => board[index]).filter((tile) => tile > 0)
    const merged = []
    for (let index = 0; index < values.length; index += 1) {
      if (values[index] === values[index + 1]) {
        const tile = values[index] * 2
        merged.push(tile)
        score += tile
        index += 1
      } else {
        merged.push(values[index])
      }
    }
    while (merged.length < PUZZLE_SIZE) merged.push(0)
    indices.forEach((boardIndex, index) => { board[boardIndex] = merged[index] })
  }

  if (board.every((tile, index) => tile === state.board[index])) return state
  spawnTile(board, random)
  const won = state.won || board.includes(PUZZLE_WIN_TILE)
  return {
    ...state,
    board,
    score,
    moves: state.moves + 1,
    won,
    gameOver: !canMove(board),
  }
}
