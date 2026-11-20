import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '../components/Icon'

const MEMORY_SYMBOLS = ['✦', '◆', '●', '▲', '☾', '⬟', '✿', '⬢']
const MINE_ROWS = 8
const MINE_COUNT = 10
const SNAKE_WIDTH = 16
const SNAKE_HEIGHT = 12
const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

function shuffled(values) {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[swap]] = [result[swap], result[index]]
  }
  return result
}

function createMemoryCards() {
  return shuffled([...MEMORY_SYMBOLS, ...MEMORY_SYMBOLS]).map((symbol, index) => ({ id: index, symbol, revealed: false, matched: false }))
}

function createMineBoard(safeIndex) {
  const safeZone = new Set([safeIndex])
  const candidates = Array.from({ length: MINE_ROWS * MINE_ROWS }, (_, index) => index).filter((index) => !safeZone.has(index))
  const mines = new Set(shuffled(candidates).slice(0, MINE_COUNT))
  return Array.from({ length: MINE_ROWS * MINE_ROWS }, (_, index) => {
    const row = Math.floor(index / MINE_ROWS)
    const column = index % MINE_ROWS
    const adjacent = []
    for (let y = Math.max(0, row - 1); y <= Math.min(MINE_ROWS - 1, row + 1); y += 1) {
      for (let x = Math.max(0, column - 1); x <= Math.min(MINE_ROWS - 1, column + 1); x += 1) {
        const neighbor = y * MINE_ROWS + x
        if (neighbor !== index && mines.has(neighbor)) adjacent.push(neighbor)
      }
    }
    return { mine: mines.has(index), adjacent: adjacent.length, revealed: false, flagged: false }
  })
}

function revealMineCells(board, startIndex) {
  const next = board.map((cell) => ({ ...cell }))
  const pending = [startIndex]
  const visited = new Set()
  while (pending.length) {
    const index = pending.pop()
    if (visited.has(index)) continue
    visited.add(index)
    const cell = next[index]
    if (!cell || cell.mine || cell.flagged || cell.revealed) continue
    cell.revealed = true
    if (cell.adjacent === 0) {
      const row = Math.floor(index / MINE_ROWS)
      const column = index % MINE_ROWS
      for (let y = Math.max(0, row - 1); y <= Math.min(MINE_ROWS - 1, row + 1); y += 1) {
        for (let x = Math.max(0, column - 1); x <= Math.min(MINE_ROWS - 1, column + 1); x += 1) {
          pending.push(y * MINE_ROWS + x)
        }
      }
    }
  }
  return next
}

function getWinner(board) {
  const line = WIN_LINES.find(([a, b, c]) => board[a] && board[a] === board[b] && board[a] === board[c])
  return line ? board[line[0]] : null
}

function chooseComputerMove(board) {
  const available = board.map((mark, index) => mark ? -1 : index).filter((index) => index >= 0)
  for (const mark of ['O', 'X']) {
    for (const index of available) {
      const candidate = [...board]
      candidate[index] = mark
      if (getWinner(candidate) === mark) return index
    }
  }
  if (available.includes(4)) return 4
  const corners = available.filter((index) => [0, 2, 6, 8].includes(index))
  if (corners.length) return corners[Math.floor(Math.random() * corners.length)]
  return available[Math.floor(Math.random() * available.length)]
}

const gameDetails = {
  snake: { number: '05', title: 'Vexlor Snake', category: 'Arcade', color: 'green', instructions: 'Steuere die Schlange mit Pfeiltasten oder WASD. Sammle Energiepunkte, ohne den Rand oder dich selbst zu berühren.' },
  memory: { number: '06', title: 'Vexlor Memory', category: 'Puzzle', color: 'violet', instructions: 'Finde alle acht Symbolpaare. Merke dir aufgedeckte Karten und löse das Feld mit möglichst wenigen Zügen.' },
  minesweeper: { number: '07', title: 'Vexlor Minesweeper', category: 'Puzzle', color: 'cyan', instructions: 'Decke alle sicheren Felder auf. Die Zahlen zeigen Minen in den Nachbarfeldern; Rechtsklick setzt eine Markierung.' },
  'tic-tac-toe': { number: '08', title: 'Vexlor Tic-Tac-Toe', category: 'Strategie', color: 'blue', instructions: 'Setze X und bilde zuerst eine Dreierreihe. Die Vexlor-KI spielt O und blockiert offene Gewinnzüge.' },
}

export function ArcadeExtraGame({ gameId, profile, onBack, onStartRound, onRecordTime, onFinishRound }) {
  const details = gameDetails[gameId]
  const rootRef = useRef(null)
  const phaseRef = useRef('ready')
  const elapsedRef = useRef(0)
  const savedSecondsRef = useRef(0)
  const finishedRef = useRef(false)
  const directionRef = useRef({ x: 1, y: 0 })
  const snakeRef = useRef(null)
  const [phase, setPhase] = useState('ready')
  const [elapsed, setElapsed] = useState(0)
  const [snakeTick, setSnakeTick] = useState(0)
  const [cards, setCards] = useState([])
  const [selectedCards, setSelectedCards] = useState([])
  const [memoryMoves, setMemoryMoves] = useState(0)
  const [memoryLocked, setMemoryLocked] = useState(false)
  const [mineBoard, setMineBoard] = useState(null)
  const [mineFlags, setMineFlags] = useState(0)
  const [ticBoard, setTicBoard] = useState(Array(9).fill(''))
  const [computerThinking, setComputerThinking] = useState(false)

  phaseRef.current = phase
  const snake = snakeRef.current
  const score = gameId === 'snake' ? snake?.score ?? 0
    : gameId === 'memory' ? memoryMoves
      : gameId === 'minesweeper' ? Math.max(0, 1000 - elapsed * 5)
        : getWinner(ticBoard) === 'X' ? 1000 : 0
  const record = profile.gameRecords?.[gameId]?.bestScore ?? 0

  const finishRound = useCallback((finalScore, won = false) => {
    if (finishedRef.current) return
    finishedRef.current = true
    const remaining = Math.max(0, elapsedRef.current - savedSecondsRef.current)
    if (remaining > 0) onFinishRound(finalScore, remaining, gameId, won)
    else onFinishRound(finalScore, 0, gameId, won)
  }, [gameId, onFinishRound])

  const startRound = () => {
    finishedRef.current = false
    elapsedRef.current = 0
    savedSecondsRef.current = 0
    setElapsed(0)
    if (gameId === 'snake') {
      snakeRef.current = { body: [{ x: 7, y: 6 }, { x: 6, y: 6 }, { x: 5, y: 6 }], food: { x: 11, y: 6 }, score: 0, over: false }
      directionRef.current = { x: 1, y: 0 }
      setSnakeTick((tick) => tick + 1)
    } else if (gameId === 'memory') {
      setCards(createMemoryCards())
      setSelectedCards([])
      setMemoryMoves(0)
      setMemoryLocked(false)
    } else if (gameId === 'minesweeper') {
      setMineBoard(null)
      setMineFlags(0)
    } else {
      setTicBoard(Array(9).fill(''))
      setComputerThinking(false)
    }
    onStartRound(gameId)
    setPhase('playing')
    window.requestAnimationFrame(() => rootRef.current?.focus())
  }

  const leaveGame = useCallback(() => {
    if (phaseRef.current === 'playing' || phaseRef.current === 'paused') finishRound(score, false)
    onBack()
  }, [finishRound, onBack, score])

  useEffect(() => {
    if (phase !== 'playing') return undefined
    const timer = window.setInterval(() => {
      elapsedRef.current += 1
      setElapsed(elapsedRef.current)
      if (elapsedRef.current - savedSecondsRef.current >= 10) {
        savedSecondsRef.current += 10
        onRecordTime(10)
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [phase, onRecordTime])

  useEffect(() => {
    if (phase !== 'playing' || gameId !== 'snake') return undefined
    const timer = window.setInterval(() => {
      const current = snakeRef.current
      if (!current || current.over) return
      const direction = directionRef.current
      const head = { x: current.body[0].x + direction.x, y: current.body[0].y + direction.y }
      const eating = head.x === current.food.x && head.y === current.food.y
      const collisionBody = eating ? current.body : current.body.slice(0, -1)
      if (head.x < 0 || head.x >= SNAKE_WIDTH || head.y < 0 || head.y >= SNAKE_HEIGHT
        || collisionBody.some((part) => part.x === head.x && part.y === head.y)) {
        current.over = true
        finishRound(current.score, false)
        setPhase('gameover')
        return
      }
      const body = [head, ...current.body]
      if (!eating) body.pop()
      const occupied = new Set(body.map((part) => `${part.x},${part.y}`))
      const free = []
      for (let y = 0; y < SNAKE_HEIGHT; y += 1) {
        for (let x = 0; x < SNAKE_WIDTH; x += 1) if (!occupied.has(`${x},${y}`)) free.push({ x, y })
      }
      if (eating) current.food = free[Math.floor(Math.random() * free.length)] ?? head
      current.body = body
      if (eating) current.score += 10
      setSnakeTick((tick) => tick + 1)
    }, Math.max(80, 145 - Math.floor((snake?.score ?? 0) / 50) * 5))
    return () => window.clearInterval(timer)
  }, [finishRound, gameId, phase, snake?.score])

  useEffect(() => {
    if (gameId !== 'memory' || selectedCards.length !== 2) return undefined
    const [first, second] = selectedCards
    if (cards[first]?.symbol === cards[second]?.symbol) {
      setCards((current) => current.map((card, index) => index === first || index === second ? { ...card, matched: true } : card))
      setSelectedCards([])
      if (cards.filter((card) => card.matched).length === cards.length - 2) {
        const finalScore = Math.max(100, 1000 - memoryMoves * 25)
        finishRound(finalScore, true)
        setPhase('gameover')
      }
      return undefined
    }
    setMemoryLocked(true)
    const timer = window.setTimeout(() => {
      setCards((current) => current.map((card, index) => index === first || index === second ? { ...card, revealed: false } : card))
      setSelectedCards([])
      setMemoryLocked(false)
    }, 750)
    return () => window.clearTimeout(timer)
  }, [cards, finishRound, gameId, memoryMoves, selectedCards])

  useEffect(() => {
    if (!computerThinking || phase !== 'playing') return undefined
    const timer = window.setTimeout(() => {
      if (getWinner(ticBoard) || ticBoard.every(Boolean)) return
      const index = chooseComputerMove(ticBoard)
      if (index === undefined) return
      const next = [...ticBoard]
      next[index] = 'O'
      setTicBoard(next)
      setComputerThinking(false)
      if (getWinner(next)) {
        finishRound(0, false)
        setPhase('gameover')
      } else if (next.every(Boolean)) {
        finishRound(250, false)
        setPhase('gameover')
      }
    }, 300)
    return () => window.clearTimeout(timer)
  }, [computerThinking, finishRound, phase, ticBoard])

  useEffect(() => {
    if (gameId === 'snake') rootRef.current?.focus()
  }, [gameId])

  const setDirection = (direction) => {
    if (phase !== 'playing' || gameId !== 'snake') return
    const current = directionRef.current
    if (direction.x === -current.x && direction.y === -current.y) return
    directionRef.current = direction
  }

  const handleKeyDown = (event) => {
    const key = event.key.toLowerCase()
    const directions = {
      arrowup: { x: 0, y: -1 }, w: { x: 0, y: -1 },
      arrowdown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
      arrowleft: { x: -1, y: 0 }, a: { x: -1, y: 0 },
      arrowright: { x: 1, y: 0 }, d: { x: 1, y: 0 },
    }
    if (gameId === 'snake' && directions[key]) {
      event.preventDefault()
      setDirection(directions[key])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setPhase((current) => current === 'playing' ? 'paused' : current === 'paused' ? 'playing' : current)
    } else if (event.key === 'Enter' && phase !== 'playing') {
      event.preventDefault()
      if (phase === 'paused') setPhase('playing')
      else startRound()
    }
  }

  const chooseMemoryCard = (index) => {
    if (phase !== 'playing' || memoryLocked || cards[index]?.revealed || cards[index]?.matched) return
    setCards((current) => current.map((card, cardIndex) => cardIndex === index ? { ...card, revealed: true } : card))
    if (selectedCards.length === 0) setSelectedCards([index])
    else {
      setSelectedCards([...selectedCards, index])
      setMemoryMoves((moves) => moves + 1)
    }
  }

  const chooseMineCell = (index, flag = false) => {
    if (phase !== 'playing') return
    let board = mineBoard
    if (!board) {
      if (flag) {
        const next = createMineBoard(index)
        next[index].flagged = true
        setMineBoard(next)
        setMineFlags(1)
        return
      }
      board = createMineBoard(index)
    }
    if (flag) {
      if (board[index].revealed) return
      const next = board.map((cell, cellIndex) => cellIndex === index ? { ...cell, flagged: !cell.flagged } : cell)
      setMineFlags((count) => count + (next[index].flagged ? 1 : -1))
      setMineBoard(next)
      return
    }
    if (board[index].revealed || board[index].flagged) return
    if (board[index].mine) {
      const revealed = board.map((cell) => ({ ...cell, revealed: cell.mine || cell.revealed }))
      setMineBoard(revealed)
      finishRound(0, false)
      setPhase('gameover')
      return
    }
    const next = revealMineCells(board, index)
    setMineBoard(next)
    const safeRevealed = next.filter((cell) => cell.revealed && !cell.mine).length
    if (safeRevealed === next.length - MINE_COUNT) {
      finishRound(Math.max(100, 1000 - elapsedRef.current * 5 + mineFlags * 5), true)
      setPhase('gameover')
    }
  }

  const chooseTicCell = (index) => {
    if (phase !== 'playing' || computerThinking || ticBoard[index]) return
    const next = [...ticBoard]
    next[index] = 'X'
    setTicBoard(next)
    if (getWinner(next)) {
      finishRound(1000, true)
      setPhase('gameover')
    } else if (next.every(Boolean)) {
      finishRound(250, false)
      setPhase('gameover')
    } else setComputerThinking(true)
  }

  const gameOver = phase === 'gameover'
  const finalWinner = gameId === 'tic-tac-toe' ? getWinner(ticBoard) : null

  return <section ref={rootRef} className={`arcade-page arcade-mini-page arcade-extra-page ${details.color}`} tabIndex="-1" onKeyDown={handleKeyDown}>
    <header className="arcade-game-toolbar">
      <button type="button" className="arcade-back-button" onClick={leaveGame}><Icon name="arrow" /> Zur Arcade</button>
      <div className="arcade-game-heading"><span className="section-kicker">VEXLOR ARCADE / {details.category.toUpperCase()}</span><h1>{details.title}</h1></div>
      <div className="arcade-extra-toolbar-actions">
        <button type="button" className="arcade-extra-control" onClick={startRound}>↻ Neustart</button>
        <button type="button" className="arcade-extra-control" onClick={() => setPhase((current) => current === 'playing' ? 'paused' : current === 'paused' ? 'playing' : current)} disabled={phase === 'ready' || gameOver}>
          {phase === 'paused' ? '▶ Fortsetzen' : 'Ⅱ Pause'}
        </button>
      </div>
    </header>
    <div className="arcade-extra-hud">
      <div><span>PUNKTE</span><strong>{gameId === 'memory' ? memoryMoves : Math.floor(score).toLocaleString('de-DE')}</strong></div>
      <div><span>ZEIT</span><strong>{`${Math.floor(elapsed / 60).toString().padStart(2, '0')}:${(elapsed % 60).toString().padStart(2, '0')}`}</strong></div>
      <div><span>REKORD</span><strong>{record.toLocaleString('de-DE')}</strong></div>
      {gameId === 'minesweeper' && <div><span>MARKIERT</span><strong>{mineFlags}/{MINE_COUNT}</strong></div>}
      {gameId === 'tic-tac-toe' && <div><span>GEGNER</span><strong>{computerThinking ? 'ZUG …' : 'VEXLOR KI'}</strong></div>}
    </div>
    <div className={`arcade-extra-arena ${gameId}`}>
      {gameId === 'snake' && <div className="arcade-snake-board" aria-label="Snake-Spielfeld">
        {Array.from({ length: SNAKE_WIDTH * SNAKE_HEIGHT }, (_, index) => {
          const x = index % SNAKE_WIDTH
          const y = Math.floor(index / SNAKE_WIDTH)
          const bodyIndex = snake?.body.findIndex((part) => part.x === x && part.y === y) ?? -1
          const isFood = snake?.food.x === x && snake?.food.y === y
          return <span key={index} className={`arcade-snake-cell${bodyIndex === 0 ? ' head' : bodyIndex > 0 ? ' body' : isFood ? ' food' : ''}`} />
        })}
        <span className="arcade-snake-tick" aria-hidden="true">{snakeTick}</span>
      </div>}
      {gameId === 'memory' && <div className="arcade-memory-board" aria-label="Memory-Spielfeld">
        {cards.map((card, index) => <button key={card.id} type="button" className={`arcade-memory-card${card.revealed || card.matched ? ' revealed' : ''}${card.matched ? ' matched' : ''}`} onClick={() => chooseMemoryCard(index)} aria-label={card.revealed || card.matched ? card.symbol : `Karte ${index + 1}`} disabled={phase !== 'playing' || card.matched}>
          {card.revealed || card.matched ? card.symbol : '?'}
        </button>)}
      </div>}
      {gameId === 'minesweeper' && <div className="arcade-minesweeper-board" aria-label="Minesweeper-Spielfeld">
        {Array.from({ length: MINE_ROWS * MINE_ROWS }, (_, index) => {
          const cell = mineBoard?.[index]
          return <button key={index} type="button" className={`arcade-mine-cell${cell?.revealed ? ' revealed' : ''}${cell?.mine && cell.revealed ? ' mine' : ''}`} onClick={() => chooseMineCell(index)} onContextMenu={(event) => { event.preventDefault(); chooseMineCell(index, true) }} aria-label={cell?.revealed ? cell.mine ? 'Mine' : `Feld ${cell.adjacent}` : cell?.flagged ? 'Markiertes Feld' : 'Verdecktes Feld'} disabled={phase !== 'playing'}>
            {cell?.revealed ? cell.mine ? '✹' : cell.adjacent || '' : cell?.flagged ? '⚑' : ''}
          </button>
        })}
      </div>}
      {gameId === 'tic-tac-toe' && <div className="arcade-tic-board" aria-label="Tic-Tac-Toe-Spielfeld">
        {ticBoard.map((mark, index) => <button key={index} type="button" className={`arcade-tic-cell ${mark.toLowerCase()}`} onClick={() => chooseTicCell(index)} disabled={phase !== 'playing' || Boolean(mark) || computerThinking} aria-label={`Feld ${index + 1}${mark ? `, ${mark}` : ''}`}>{mark}</button>)}
      </div>}
      {phase !== 'playing' && <div className={`arcade-game-overlay ${phase}`}>
        <div className="arcade-overlay-kicker">{phase === 'ready' ? 'KURZ ERKLÄRT' : phase === 'paused' ? 'SPIEL ANGEHALTEN' : 'RUNDE BEENDET'}</div>
        <h2>{phase === 'ready' ? 'Bereit?' : phase === 'paused' ? 'Pause' : gameId === 'snake' ? 'Schlange gestoppt' : gameId === 'memory' ? 'Alle Paare gefunden!' : gameId === 'minesweeper' ? mineBoard?.some((cell) => cell.mine && cell.revealed) ? 'Mine erwischt!' : 'Feld geräumt!' : finalWinner === 'X' ? 'Du gewinnst!' : finalWinner === 'O' ? 'Die KI gewinnt.' : 'Unentschieden'}</h2>
        <p>{details.instructions}</p>
        <button type="button" className="primary-button" onClick={phase === 'paused' ? () => setPhase('playing') : startRound}>{phase === 'paused' ? 'Weiter' : gameOver ? 'Nochmal spielen' : 'Spiel starten'} <Icon name={gameOver ? 'refresh' : 'arrow'} /></button>
        <span className="arcade-overlay-hint">{gameId === 'snake' ? 'PFEILTASTEN / WASD · ESC PAUSE' : 'KLICKE AUF DIE FELDER · ESC PAUSE'}</span>
      </div>}
    </div>
    <footer className="arcade-game-footer"><span>{details.instructions}</span><span className="arcade-game-local"><i /> Fortschritt lokal gespeichert</span></footer>
  </section>
}
