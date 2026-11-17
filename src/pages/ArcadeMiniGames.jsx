import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { advanceRunner, createRunnerState, RUNNER_GROUND, RUNNER_HEIGHT, RUNNER_WIDTH } from '../services/runner-engine.mjs'
import { createPuzzleState, movePuzzle } from '../services/puzzle-engine.mjs'
import { recordPuzzleProgress } from '../services/arcade-profile.mjs'
import {
  MAX_CLICKER_LEVEL,
  accrueClickerIncome,
  collectClickerEnergy,
  getClickUpgradeCost,
  getClickerPower,
  getGeneratorCost,
  purchaseClickUpgrade,
  purchaseGenerator,
} from '../services/clicker-engine.mjs'

function formatNumber(value) {
  return Math.floor(value).toLocaleString('de-DE')
}

function formatClock(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0')
  const remainder = Math.floor(seconds % 60).toString().padStart(2, '0')
  return `${minutes}:${remainder}`
}

function usePlayTime(onRecordTime) {
  useEffect(() => {
    let elapsed = 0
    let saved = 0
    const timer = window.setInterval(() => {
      elapsed += 1
      if (elapsed - saved >= 10) {
        onRecordTime(10)
        saved += 10
      }
    }, 1000)
    return () => {
      window.clearInterval(timer)
      if (elapsed > saved) onRecordTime(elapsed - saved)
    }
  }, [onRecordTime])
}

function MiniGameToolbar({ number, title, onBack }) {
  return <header className="arcade-game-toolbar">
    <button type="button" className="arcade-back-button" onClick={onBack}><Icon name="arrow" /> Zur Arcade</button>
    <div className="arcade-game-heading">
      <span className="section-kicker">VEXLOR ARCADE / SPIEL {number}</span>
      <h1>{title}</h1>
    </div>
    <span className="arcade-mini-game-tag"><i /> OHNE INTERNET</span>
  </header>
}

export function RunnerGame({ profile, onBack, onStartRound, onRecordTime, onFinishRound }) {
  const canvasRef = useRef(null)
  const gameRef = useRef(null)
  const inputRef = useRef({ jump: false, slide: false })
  const callbackRef = useRef({})
  const finishRef = useRef(() => {})
  const phaseRef = useRef('ready')
  const jumpTimerRef = useRef(0)
  const [phase, setPhase] = useState('ready')
  const [hud, setHud] = useState({ score: 0, elapsed: 0, speed: 270 })

  callbackRef.current = { onStartRound, onRecordTime, onFinishRound }
  phaseRef.current = phase

  const finishRun = useCallback((game) => {
    if (!game || game.finished) return
    game.finished = true
    const totalSeconds = Math.floor(game.elapsed)
    const unsavedSeconds = Math.max(0, totalSeconds - game.savedSeconds)
    game.savedSeconds = totalSeconds
    callbackRef.current.onFinishRound(game.score, unsavedSeconds, 'runner')
  }, [])
  finishRef.current = finishRun

  const startRun = useCallback(() => {
    gameRef.current = { ...createRunnerState(), savedSeconds: 0 }
    inputRef.current = { jump: false, slide: false }
    callbackRef.current.onStartRound('runner')
    setHud({ score: 0, elapsed: 0, speed: 270 })
    setPhase('playing')
    window.requestAnimationFrame(() => canvasRef.current?.focus())
  }, [])

  const pauseRun = useCallback(() => {
    inputRef.current = { jump: false, slide: false }
    setPhase('paused')
    window.requestAnimationFrame(() => canvasRef.current?.focus())
  }, [])

  const resumeRun = useCallback(() => {
    setPhase('playing')
    window.requestAnimationFrame(() => canvasRef.current?.focus())
  }, [])

  const handleBack = useCallback(() => {
    if (phaseRef.current === 'playing' || phaseRef.current === 'paused') finishRef.current(gameRef.current)
    inputRef.current = { jump: false, slide: false }
    onBack()
  }, [onBack])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return undefined
    const resize = () => {
      const bounds = canvas.getBoundingClientRect()
      const scale = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(bounds.width * scale))
      canvas.height = Math.max(1, Math.round(bounds.height * scale))
      context.setTransform(canvas.width / RUNNER_WIDTH, 0, 0, canvas.height / RUNNER_HEIGHT, 0, 0)
      drawRunner(context, gameRef.current)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    canvas.focus()
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (phase !== 'playing') {
      const context = canvasRef.current?.getContext('2d')
      if (context) drawRunner(context, gameRef.current)
      return undefined
    }
    const context = canvasRef.current?.getContext('2d')
    const game = gameRef.current
    if (!context || !game) return undefined

    let frameId = 0
    let previousTime = 0
    let lastHudUpdate = 0
    const renderFrame = (timestamp) => {
      const delta = previousTime === 0 ? 0 : Math.min((timestamp - previousTime) / 1000, 0.05)
      previousTime = timestamp
      advanceRunner(game, inputRef.current, delta)
      drawRunner(context, game)
      const unrecordedSeconds = Math.floor(game.elapsed) - game.savedSeconds
      if (unrecordedSeconds >= 10) {
        game.savedSeconds += unrecordedSeconds
        callbackRef.current.onRecordTime(unrecordedSeconds)
      }
      if (timestamp - lastHudUpdate >= 120) {
        lastHudUpdate = timestamp
        setHud({ score: game.score, elapsed: game.elapsed, speed: game.speed })
      }
      if (game.status === 'gameover') {
        setHud({ score: game.score, elapsed: game.elapsed, speed: game.speed })
        finishRef.current(game)
        setPhase('gameover')
        return
      }
      frameId = window.requestAnimationFrame(renderFrame)
    }
    frameId = window.requestAnimationFrame(renderFrame)
    return () => window.cancelAnimationFrame(frameId)
  }, [phase])

  useEffect(() => {
    const onBlur = () => {
      inputRef.current = { jump: false, slide: false }
      if (phaseRef.current === 'playing') setPhase('paused')
    }
    window.addEventListener('blur', onBlur)
    return () => window.removeEventListener('blur', onBlur)
  }, [])

  useEffect(() => () => {
    window.clearTimeout(jumpTimerRef.current)
    if (phaseRef.current === 'playing' || phaseRef.current === 'paused') finishRef.current(gameRef.current)
  }, [])

  const jump = () => {
    if (phase === 'ready' || phase === 'gameover') {
      startRun()
      return
    }
    if (phase !== 'playing') return
    inputRef.current.jump = true
    window.clearTimeout(jumpTimerRef.current)
    jumpTimerRef.current = window.setTimeout(() => { inputRef.current.jump = false }, 110)
  }

  const handleKeyDown = (event) => {
    if (event.code === 'Space' || event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') {
      event.preventDefault()
      event.stopPropagation()
      jump()
    } else if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') {
      event.preventDefault()
      event.stopPropagation()
      if (phase === 'playing') inputRef.current.slide = true
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      if (phase === 'playing') pauseRun()
      else if (phase === 'paused') resumeRun()
    } else if (event.key === 'Enter' && (phase === 'ready' || phase === 'gameover')) {
      event.preventDefault()
      event.stopPropagation()
      startRun()
    } else if (event.key === 'Enter' && phase === 'paused') {
      event.preventDefault()
      event.stopPropagation()
      resumeRun()
    }
  }

  const handleKeyUp = (event) => {
    if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') inputRef.current.slide = false
    if (event.code === 'Space' || event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') inputRef.current.jump = false
  }

  return <section className="arcade-page arcade-mini-page">
    <MiniGameToolbar number="02" title={<>Vexlor <span>Runner</span></>} onBack={handleBack} />
    <div className="arcade-mini-status">
      <div><span>PUNKTE</span><strong>{formatNumber(hud.score)}</strong></div>
      <div><span>ZEIT</span><strong>{formatClock(hud.elapsed)}</strong></div>
      <div><span>TEMPO</span><strong>{Math.round(hud.speed)} <small>PIXEL/S</small></strong></div>
      <div><span>REKORD</span><strong>{formatNumber(profile.runnerBestScore)}</strong></div>
      <button type="button" className="arcade-pause-button" onClick={phase === 'playing' ? pauseRun : resumeRun} disabled={phase !== 'playing' && phase !== 'paused'}>
        {phase === 'paused' ? 'Fortsetzen' : 'Ⅱ Pause'}
      </button>
    </div>
    <div className="arcade-runner-arena">
      <canvas
        ref={canvasRef}
        tabIndex="0"
        aria-label="Vexlor Runner. Mit Leertaste oder Pfeil hoch springen, mit Pfeil runter ducken."
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onBlur={() => { inputRef.current = { jump: false, slide: false } }}
      />
      {phase !== 'playing' && <div className={`arcade-game-overlay ${phase}`}>
        {phase === 'ready' && <>
          <div className="arcade-overlay-kicker">BEREIT ZUM SPRINT</div>
          <h2>Wie weit kommst du?</h2>
          <p>Springe über Hindernisse, rutsche unter Barrieren hindurch und sammle Energiekugeln.</p>
          <button type="button" className="primary-button" onClick={startRun}>Lauf starten <Icon name="arrow" /></button>
          <span className="arcade-overlay-hint">LEERTASTE ODER ↑ ZUM SPRINGEN</span>
        </>}
        {phase === 'paused' && <>
          <div className="arcade-overlay-kicker">SPRINT ANGEHALTEN</div><h2>Pause</h2>
          <p>Deine Bestweite bleibt gespeichert.</p>
          <button type="button" className="primary-button" onClick={resumeRun}>Weiterlaufen <Icon name="arrow" /></button>
          <span className="arcade-overlay-hint">ESC ZUM FORTSETZEN</span>
        </>}
        {phase === 'gameover' && <>
          <div className="arcade-overlay-kicker">SPRINT BEENDET</div><h2>Zusammenstoß!</h2>
          <p>Deine Distanz: <strong>{formatNumber(hud.score)} Punkte</strong></p>
          <button type="button" className="primary-button" onClick={startRun}>Nochmal laufen <Icon name="refresh" /></button>
          <span className="arcade-overlay-hint">EINGABETASTE FÜR EINEN NEUEN LAUF</span>
        </>}
      </div>}
    </div>
    <div className="arcade-runner-controls">
      <span><kbd>LEERTASTE</kbd> / <kbd>↑</kbd> Springen</span>
      <span><kbd>↓</kbd> / <kbd>S</kbd> Ducken</span>
      <span><kbd>ESC</kbd> Pause</span>
      <button type="button" onClick={jump}>Springen <Icon name="arrow" /></button>
      <button
        type="button"
        onPointerDown={() => { if (phase === 'playing') inputRef.current.slide = true }}
        onPointerUp={() => { inputRef.current.slide = false }}
        onPointerLeave={() => { inputRef.current.slide = false }}
      >Ducken</button>
    </div>
  </section>
}

function drawRunner(context, game) {
  context.clearRect(0, 0, RUNNER_WIDTH, RUNNER_HEIGHT)
  const background = context.createLinearGradient(0, 0, 0, RUNNER_HEIGHT)
  background.addColorStop(0, '#082332')
  background.addColorStop(0.7, '#0b1725')
  background.addColorStop(1, '#07101b')
  context.fillStyle = background
  context.fillRect(0, 0, RUNNER_WIDTH, RUNNER_HEIGHT)

  const elapsed = game?.elapsed ?? 0
  for (let index = 0; index < 56; index += 1) {
    const x = (index * 173 + 45) % RUNNER_WIDTH
    const y = (index * 61 + elapsed * (10 + index % 4 * 5)) % (RUNNER_GROUND - 30)
    context.globalAlpha = 0.2 + index % 4 * 0.12
    context.fillStyle = index % 5 === 0 ? '#54dce9' : '#d8edff'
    context.fillRect(x, y, 2, 2)
  }
  context.globalAlpha = 1
  context.fillStyle = 'rgba(44, 197, 211, .08)'
  context.beginPath()
  context.ellipse(670, 155, 210, 72, 0, 0, Math.PI * 2)
  context.fill()

  context.fillStyle = '#0a202b'
  context.fillRect(0, RUNNER_GROUND, RUNNER_WIDTH, RUNNER_HEIGHT - RUNNER_GROUND)
  context.strokeStyle = 'rgba(72, 221, 231, .28)'
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(0, RUNNER_GROUND)
  context.lineTo(RUNNER_WIDTH, RUNNER_GROUND)
  context.stroke()
  const offset = (elapsed * (game?.speed ?? 120) * 0.8) % 46
  context.strokeStyle = 'rgba(58, 173, 194, .11)'
  context.lineWidth = 1
  for (let x = -offset; x < RUNNER_WIDTH; x += 46) {
    context.beginPath()
    context.moveTo(x, RUNNER_GROUND)
    context.lineTo(x - 45, RUNNER_HEIGHT)
    context.stroke()
  }

  if (!game) return
  for (const obstacle of game.obstacles) {
    context.save()
    context.shadowColor = obstacle.tall ? '#ff8b76' : '#45dce6'
    context.shadowBlur = 14
    context.fillStyle = obstacle.tall ? 'rgba(255, 104, 120, .25)' : 'rgba(41, 207, 220, .22)'
    context.strokeStyle = obstacle.tall ? '#ff8c90' : '#58e6ed'
    context.lineWidth = 2
    context.beginPath()
    context.roundRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height, 5)
    context.fill()
    context.stroke()
    context.restore()
  }
  for (const token of game.tokens) {
    context.save()
    context.shadowColor = '#f2d470'
    context.shadowBlur = 16
    context.fillStyle = '#ffe58c'
    context.beginPath()
    context.arc(token.x + token.width / 2, token.y + token.height / 2, token.width / 2, 0, Math.PI * 2)
    context.fill()
    context.restore()
  }

  const player = game.player
  context.save()
  context.shadowColor = '#40ddeb'
  context.shadowBlur = 17
  context.fillStyle = '#a4f5ff'
  context.strokeStyle = '#40d8e6'
  context.lineWidth = 2
  context.beginPath()
  context.roundRect(player.x, player.y, player.width, player.height, player.sliding ? 8 : 10)
  context.fill()
  context.stroke()
  context.fillStyle = '#087889'
  context.beginPath()
  context.roundRect(player.x + player.width - 11, player.y + 8, 7, 7, 3)
  context.fill()
  context.restore()
}

export function ClickerGame({ profile, onBack, onStartRound, onUpdate, onRecordTime }) {
  const sessionStartedRef = useRef(false)
  const clicker = profile.clicker
  usePlayTime(onRecordTime)

  useEffect(() => {
    if (clicker.generators === 0) return undefined
    const timer = window.setInterval(() => {
      onUpdate((current) => {
        const currentClicker = current.clicker
        const nextClicker = accrueClickerIncome(currentClicker)
        return nextClicker === currentClicker ? current : { ...current, clicker: nextClicker }
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [clicker.generators, onUpdate])

  const startSession = () => {
    if (sessionStartedRef.current) return
    sessionStartedRef.current = true
    onStartRound('clicker')
  }

  const collect = () => {
    startSession()
    onUpdate((current) => {
      const nextClicker = collectClickerEnergy(current.clicker)
      return nextClicker === current.clicker ? current : { ...current, clicker: nextClicker }
    })
  }

  const buyClickUpgrade = () => {
    if (clicker.energy < getClickUpgradeCost(clicker.upgrades)) return
    startSession()
    onUpdate((current) => {
      const nextClicker = purchaseClickUpgrade(current.clicker)
      return nextClicker === current.clicker ? current : { ...current, clicker: nextClicker }
    })
  }

  const buyGenerator = () => {
    if (clicker.energy < getGeneratorCost(clicker.generators)) return
    startSession()
    onUpdate((current) => {
      const nextClicker = purchaseGenerator(current.clicker)
      return nextClicker === current.clicker ? current : { ...current, clicker: nextClicker }
    })
  }

  return <section className="arcade-page arcade-mini-page arcade-clicker-page">
    <MiniGameToolbar number="03" title={<>Vexlor <span>Clicker</span></>} onBack={onBack} />
    <div className="arcade-clicker-layout">
      <section className="arcade-clicker-core-panel">
        <div className="section-kicker">GESAMMELTE ENERGIE</div>
        <strong className="arcade-energy-count">{formatNumber(clicker.energy)}</strong>
        <span className="arcade-energy-label">ENERGIE</span>
        <button type="button" className="arcade-energy-core" onClick={collect} aria-label={`Energie sammeln, ${getClickerPower(clicker)} pro Klick`}>
          <span className="arcade-energy-ring ring-one" /><span className="arcade-energy-ring ring-two" />
          <span className="arcade-energy-gem"><i /></span>
          <span className="arcade-energy-plus">+{getClickerPower(clicker)}</span>
        </button>
        <p>Klicke den Energiekern, um Energie zu sammeln.</p>
        <div className="arcade-clicker-lifetime"><span>LEBENSLANG GESAMMELT</span><strong>{formatNumber(clicker.lifetimeEnergy)}</strong></div>
      </section>
      <section className="arcade-clicker-upgrades">
        <div className="arcade-section-heading compact">
          <div><div className="section-kicker">AUSBAUEN</div><h2>Deine Verbesserungen</h2></div>
          <span className="arcade-income-badge">+{clicker.generators}/s</span>
        </div>
        <article className="arcade-upgrade-card">
          <span className="arcade-upgrade-icon violet"><Icon name="bolt" /></span>
          <div><strong>Stärkerer Impuls</strong><small>+1 Energie pro Klick · Stufe {clicker.upgrades}/50</small></div>
          <button type="button" onClick={buyClickUpgrade} disabled={clicker.energy < getClickUpgradeCost(clicker.upgrades) || clicker.upgrades >= MAX_CLICKER_LEVEL}>
            <span>KAUFEN</span><strong>{formatNumber(getClickUpgradeCost(clicker.upgrades))} <i>ENERGIE</i></strong>
          </button>
        </article>
        <article className="arcade-upgrade-card">
          <span className="arcade-upgrade-icon cyan"><Icon name="performance" /></span>
          <div><strong>Automatischer Reaktor</strong><small>+1 Energie pro Sekunde · Stufe {clicker.generators}/50</small></div>
          <button type="button" onClick={buyGenerator} disabled={clicker.energy < getGeneratorCost(clicker.generators) || clicker.generators >= MAX_CLICKER_LEVEL}>
            <span>KAUFEN</span><strong>{formatNumber(getGeneratorCost(clicker.generators))} <i>ENERGIE</i></strong>
          </button>
        </article>
        <div className="arcade-clicker-tip"><Icon name="spark" /><span>Dein Fortschritt wird lokal gespeichert. Reaktoren produzieren Energie, solange die Arcade geöffnet ist.</span></div>
      </section>
    </div>
    <footer className="arcade-game-footer"><span><kbd>KLICK</kbd> Energie sammeln</span><span><kbd>VERBESSERUNGEN</kbd> Produktion steigern</span><span className="arcade-game-local"><i /> Spielstand wird lokal gespeichert</span></footer>
  </section>
}

const puzzleDirections = [
  { direction: 'up', label: 'Nach oben', symbol: '↑' },
  { direction: 'left', label: 'Nach links', symbol: '←' },
  { direction: 'down', label: 'Nach unten', symbol: '↓' },
  { direction: 'right', label: 'Nach rechts', symbol: '→' },
]

export function PuzzleGame({ profile, onBack, onStartRound, onUpdate, onRecordTime }) {
  const puzzle = profile.puzzle
  const boardRef = useRef(null)
  const puzzleRef = useRef(puzzle)
  puzzleRef.current = puzzle
  usePlayTime(onRecordTime)

  useEffect(() => { boardRef.current?.focus() }, [])

  const startGame = () => {
    const next = createPuzzleState()
    onStartRound('puzzle')
    puzzleRef.current = next
    onUpdate((current) => recordPuzzleProgress(current, next))
    window.requestAnimationFrame(() => boardRef.current?.focus())
  }

  const move = (direction) => {
    const next = movePuzzle(puzzleRef.current, direction)
    if (next === puzzleRef.current) return
    puzzleRef.current = next
    onUpdate((current) => recordPuzzleProgress(current, next))
  }

  const handleKeyDown = (event) => {
    const key = event.key.toLowerCase()
    const direction = {
      arrowup: 'up', w: 'up',
      arrowleft: 'left', a: 'left',
      arrowdown: 'down', s: 'down',
      arrowright: 'right', d: 'right',
    }[key]
    if (direction) {
      event.preventDefault()
      event.stopPropagation()
      move(direction)
    } else if (event.key === 'Enter' && !puzzle.active) {
      event.preventDefault()
      event.stopPropagation()
      startGame()
    }
  }

  return <section className="arcade-page arcade-mini-page arcade-puzzle-page">
    <MiniGameToolbar number="04" title={<>Vexlor <span>Puzzle</span></>} onBack={onBack} />
    <div className="arcade-puzzle-layout">
      <section className="arcade-puzzle-board-panel">
        <div className="arcade-puzzle-stats">
          <div><span>PUNKTE</span><strong>{formatNumber(puzzle.score)}</strong></div>
          <div><span>BESTWERT</span><strong>{formatNumber(puzzle.bestScore)}</strong></div>
          <div><span>BESTER STEIN</span><strong>{puzzle.bestTile || '–'}</strong></div>
        </div>
        <div ref={boardRef} className={`arcade-puzzle-board${!puzzle.active ? ' inactive' : ''}`} tabIndex="0" onKeyDown={handleKeyDown} aria-label="Puzzle-Spielfeld, mit den Pfeiltasten die Kacheln verschieben">
          {puzzle.board.map((tile, index) => <div key={index} className={`arcade-puzzle-tile tile-${tile || 'empty'}`} aria-label={tile ? String(tile) : 'Leer'}>
            {tile || ''}
          </div>)}
          {!puzzle.active && <div className="arcade-puzzle-overlay">
            <span className="arcade-overlay-kicker">NEUES RÄTSEL</span>
            <h2>Füge die Zahlen zusammen.</h2>
            <p>Gleiche Zahlen verschmelzen. Erreiche 2048 und spiele danach weiter.</p>
            <button type="button" className="primary-button" onClick={startGame}>Puzzle starten <Icon name="arrow" /></button>
          </div>}
          {puzzle.gameOver && <div className="arcade-puzzle-overlay">
            <span className="arcade-overlay-kicker">KEINE ZÜGE MEHR</span>
            <h2>Gut kombiniert!</h2>
            <p>Du hast {formatNumber(puzzle.score)} Punkte erreicht.</p>
            <button type="button" className="primary-button" onClick={startGame}>Neues Puzzle <Icon name="refresh" /></button>
          </div>}
        </div>
        {puzzle.won && !puzzle.gameOver && <div className="arcade-puzzle-win" role="status">2048 erreicht – stark! Du kannst weiterspielen oder ein neues Puzzle starten.</div>}
        <div className="arcade-puzzle-controls" aria-label="Puzzle-Steuerung">
          {puzzleDirections.map(({ direction, label, symbol }) => <button key={direction} type="button" aria-label={label} onClick={() => move(direction)} disabled={!puzzle.active || puzzle.gameOver}>{symbol}</button>)}
        </div>
      </section>
      <aside className="arcade-puzzle-info">
        <div className="section-kicker">DAS ZIEL</div>
        <h2>Eine Zahl, ein Zug nach dem anderen.</h2>
        <p>Verschiebe alle Kacheln. Treffen zwei gleiche Zahlen aufeinander, verschmelzen sie. Nach jedem Zug erscheint eine neue 2 oder 4.</p>
        <div className="arcade-puzzle-rule"><span>1</span><p><strong>Pfeiltasten</strong><small>oder die Steuerknöpfe zum Verschieben</small></p></div>
        <div className="arcade-puzzle-rule"><span>2</span><p><strong>Gleiche Zahlen</strong><small>werden addiert und geben Punkte</small></p></div>
        <div className="arcade-puzzle-rule"><span>3</span><p><strong>Erreiche 2048</strong><small>und entscheide, ob du weiterspielst</small></p></div>
        <div className="arcade-puzzle-record"><Icon name="crown" /><span>{profile.puzzle.wins} {profile.puzzle.wins === 1 ? 'Sieg' : 'Siege'} · {profile.puzzle.gamesPlayed} {profile.puzzle.gamesPlayed === 1 ? 'Puzzle' : 'Puzzles'} gespielt</span></div>
      </aside>
    </div>
    <footer className="arcade-game-footer"><span><kbd>↑ ↓ ← →</kbd> / <kbd>WASD</kbd> Verschieben</span><span><kbd>2048</kbd> Das Ziel</span><span className="arcade-game-local"><i /> Spielstand wird lokal gespeichert</span></footer>
  </section>
}
