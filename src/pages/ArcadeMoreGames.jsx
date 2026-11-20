import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '../components/Icon'

export const MORE_ARCADE_GAMES = [
  { id: 'pong', title: 'Vexlor Pong', category: 'Arcade', color: 'cyan', description: 'Schlage den Ball zurück und erreiche zuerst fünf Punkte.' },
  { id: 'breakout', title: 'Vexlor Breakout', category: 'Arcade', color: 'blue', description: 'Zerbrich alle Blöcke mit Ball und Schläger.' },
  { id: 'flappy', title: 'Vexlor Flappy Flight', category: 'Arcade', color: 'green', description: 'Fliege mit kurzen Flügelschlägen durch die Neonröhren.' },
  { id: 'bubble-shooter', title: 'Vexlor Bubble Shooter', category: 'Arcade', color: 'violet', description: 'Kombiniere gleichfarbige Blasen und räume das Feld ab.' },
  { id: 'doodle-jump', title: 'Vexlor Doodle Jump', category: 'Arcade', color: 'cyan', description: 'Springe automatisch über schwebende Plattformen und erklimme die Neonhöhe.' },
  { id: 'whack-a-mole', title: 'Vexlor Whack-a-Mole', category: 'Arcade', color: 'violet', description: 'Triff die auftauchenden Ziele, bevor die Zeit abläuft.' },
  { id: 'reaction-time', title: 'Vexlor Reaction Time', category: 'Arcade', color: 'cyan', description: 'Warte auf das Signal und teste deine Reaktionszeit.' },
  { id: 'aim-trainer', title: 'Vexlor Aim Trainer', category: 'Arcade', color: 'blue', description: 'Triff so viele Ziele wie möglich in 30 Sekunden.' },
  { id: 'stack-tower', title: 'Vexlor Stack Tower', category: 'Arcade', color: 'violet', description: 'Staple bewegliche Plattformen möglichst präzise.' },
  { id: 'neon-racer', title: 'Vexlor Neon Racer', category: 'Arcade', color: 'blue', description: 'Wechsle die Fahrspur und weiche dem immer dichteren Verkehr aus.' },
  { id: 'tetris', title: 'Vexlor Tetris', category: 'Puzzle', color: 'violet', description: 'Drehe und platziere Steine, um vollständige Reihen zu löschen.' },
  { id: 'word-scramble', title: 'Vexlor Word Scramble', category: 'Puzzle', color: 'green', description: 'Entwirre gemischte Buchstaben und finde das gesuchte Wort.' },
  { id: 'word-guess', title: 'Vexlor Word Guess', category: 'Puzzle', color: 'cyan', description: 'Errate das verdeckte Wort, bevor deine Versuche aufgebraucht sind.' },
  { id: 'lights-out', title: 'Vexlor Lights Out', category: 'Puzzle', color: 'blue', description: 'Schalte alle Lichter aus; jeder Zug ändert auch die Nachbarfelder.' },
  { id: 'sudoku', title: 'Vexlor Sudoku', category: 'Puzzle', color: 'green', description: 'Fülle das Raster so, dass jede Ziffer je Reihe, Spalte und Block nur einmal vorkommt.' },
  { id: 'sokoban', title: 'Vexlor Sokoban', category: 'Puzzle', color: 'green', description: 'Schiebe alle Kisten auf die markierten Zielfelder.' },
  { id: 'maze-runner', title: 'Vexlor Maze Runner', category: 'Puzzle', color: 'cyan', description: 'Finde den Ausgang aus einem neu erzeugten Labyrinth.' },
  { id: 'tower-of-hanoi', title: 'Vexlor Tower of Hanoi', category: 'Puzzle', color: 'violet', description: 'Versetze alle Scheiben, ohne eine größere auf eine kleinere zu legen.' },
  { id: 'number-slide', title: 'Vexlor Number Slide', category: 'Puzzle', color: 'cyan', description: 'Ordne die Zahlenkacheln durch Verschieben in die richtige Reihenfolge.' },
  { id: 'connect-four', title: 'Vexlor Connect Four', category: 'Strategie', color: 'blue', description: 'Verbinde vier Spielsteine und verhindere den Viererzug der KI.' },
  { id: 'chess', title: 'Vexlor Chess', category: 'Strategie', color: 'cyan', description: 'Spiele eine Schachpartie gegen die Vexlor-KI und setze den schwarzen König schachmatt.' },
  { id: 'battleship', title: 'Vexlor Battleship', category: 'Strategie', color: 'blue', description: 'Finde die versteckte gegnerische Flotte, bevor die KI deine Schiffe versenkt.' },
  { id: 'reversi', title: 'Vexlor Reversi', category: 'Strategie', color: 'green', description: 'Schließe gegnerische Steine zwischen deinen eigenen ein und drehe sie um.' },
  { id: 'checkers', title: 'Vexlor Checkers', category: 'Strategie', color: 'violet', description: 'Springe über gegnerische Steine, schlage sie und erreiche die Grundlinie.' },
  { id: 'mastermind', title: 'Vexlor Mastermind', category: 'Strategie', color: 'violet', description: 'Knacke den vierstelligen Farbcode mit Hinweisen zu Position und Farbe.' },
  { id: 'simon-says', title: 'Vexlor Simon Says', category: 'Sonstiges', color: 'green', description: 'Merke dir die wachsende Farbfolge und wiederhole sie.' },
  { id: 'quick-math', title: 'Vexlor Quick Math', category: 'Sonstiges', color: 'cyan', description: 'Löse zehn Kopfrechenaufgaben so schnell du kannst.' },
  { id: 'typing-speed', title: 'Vexlor Typing Speed Test', category: 'Sonstiges', color: 'blue', description: 'Tippe den angezeigten Text fehlerfrei und miss deine Geschwindigkeit.' },
  { id: 'color-match', title: 'Vexlor Color Match', category: 'Sonstiges', color: 'violet', description: 'Entscheide schnell, ob Wort und angezeigte Farbe übereinstimmen.' },
  { id: 'rock-paper-scissors', title: 'Vexlor Rock-Paper-Scissors', category: 'Sonstiges', color: 'green', description: 'Spiele Schere, Stein, Papier gegen die Vexlor-KI.' },
  { id: 'quiz-challenge', title: 'Vexlor Quiz Challenge', category: 'Sonstiges', color: 'cyan', description: 'Beantworte abwechslungsreiche Wissensfragen.' },
  { id: 'geography-quiz', title: 'Vexlor Geography Quiz', category: 'Sonstiges', color: 'blue', description: 'Teste dein Wissen über Hauptstädte und Länder.' },
  { id: 'flag-quiz', title: 'Vexlor Flag Quiz', category: 'Sonstiges', color: 'violet', description: 'Ordne Flaggen dem richtigen Land zu.' },
]

const gameById = Object.fromEntries(MORE_ARCADE_GAMES.map((game) => [game.id, game]))

function useSession(gameId, callbacks) {
  const [phase, setPhase] = useState('ready')
  const [elapsed, setElapsed] = useState(0)
  const elapsedRef = useRef(0)
  const savedRef = useRef(0)
  const finishedRef = useRef(false)
  const callbackRef = useRef(callbacks)
  callbackRef.current = callbacks

  const start = useCallback(() => {
    elapsedRef.current = 0
    savedRef.current = 0
    finishedRef.current = false
    setElapsed(0)
    callbackRef.current.onStartRound(gameId)
    setPhase('playing')
  }, [gameId])

  const finish = useCallback((score, won = false) => {
    if (finishedRef.current) return
    finishedRef.current = true
    const remaining = Math.max(0, elapsedRef.current - savedRef.current)
    callbackRef.current.onFinishRound(score, remaining, gameId, won)
    setPhase('gameover')
  }, [gameId])

  useEffect(() => {
    if (phase !== 'playing') return undefined
    const timer = window.setInterval(() => {
      elapsedRef.current += 1
      setElapsed(elapsedRef.current)
      if (elapsedRef.current - savedRef.current >= 10) {
        savedRef.current += 10
        callbackRef.current.onRecordTime(10)
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [phase])

  return {
    phase,
    elapsed,
    start,
    finish,
    pause: () => setPhase((current) => current === 'playing' ? 'paused' : current === 'paused' ? 'playing' : current),
    leave: (score) => {
      if ((phase === 'playing' || phase === 'paused') && !finishedRef.current) finish(score, false)
      callbackRef.current.onBack()
    },
  }
}

function GameFrame({ gameId, profile, callbacks, instructions, session, score = 0, children, onRestart, result, controls }) {
  const game = gameById[gameId]
  const record = profile.gameRecords?.[gameId]?.bestScore ?? 0
  const phase = session.phase
  const title = result || (phase === 'ready' ? 'Bereit?' : phase === 'paused' ? 'Pause' : 'Runde beendet')
  return <section className={`arcade-page arcade-mini-page arcade-extra-page arcade-more-page ${game.color}`} tabIndex="-1"
    onKeyDown={(event) => { if (event.key === 'Escape' && phase !== 'ready' && phase !== 'gameover') { event.preventDefault(); session.pause() } }}>
    <header className="arcade-game-toolbar">
      <button type="button" className="arcade-back-button" onClick={() => session.leave(score)}><Icon name="arrow" /> Zur Arcade</button>
      <div className="arcade-game-heading"><span className="section-kicker">VEXLOR ARCADE / {game.category.toUpperCase()}</span><h1>{game.title}</h1></div>
      <div className="arcade-extra-toolbar-actions">
        <button type="button" className="arcade-extra-control" onClick={onRestart}>↻ Neustart</button>
        <button type="button" className="arcade-extra-control" onClick={session.pause} disabled={phase === 'ready' || phase === 'gameover'}>
          {phase === 'paused' ? '▶ Fortsetzen' : 'Ⅱ Pause'}
        </button>
      </div>
    </header>
    <div className="arcade-extra-hud">
      <div><span>PUNKTE</span><strong>{Math.floor(score).toLocaleString('de-DE')}</strong></div>
      <div><span>ZEIT</span><strong>{`${Math.floor(session.elapsed / 60).toString().padStart(2, '0')}:${(session.elapsed % 60).toString().padStart(2, '0')}`}</strong></div>
      <div><span>REKORD</span><strong>{record.toLocaleString('de-DE')}</strong></div>
    </div>
    <div className={`arcade-extra-arena arcade-more-arena ${gameId}`}>
      {children}
      {phase !== 'playing' && <div className={`arcade-game-overlay ${phase}`}>
        <div className="arcade-overlay-kicker">{phase === 'ready' ? 'KURZ ERKLÄRT' : phase === 'paused' ? 'SPIEL ANGEHALTEN' : 'RUNDE BEENDET'}</div>
        <h2>{title}</h2>
        <p>{instructions}</p>
        <button type="button" className="primary-button" onClick={phase === 'paused' ? session.pause : onRestart}>
          {phase === 'paused' ? 'Weiter' : phase === 'ready' ? 'Spiel starten' : 'Nochmal spielen'} <Icon name={phase === 'gameover' ? 'refresh' : 'arrow'} />
        </button>
        <span className="arcade-overlay-hint">{controls ?? 'MIT MAUS ODER TASTATUR STEUERN · ESC PAUSE'}</span>
      </div>}
    </div>
    <footer className="arcade-game-footer"><span>{instructions}</span><span className="arcade-game-local"><i /> Fortschritt lokal gespeichert</span></footer>
  </section>
}

function Mode({ gameId, profile, callbacks, instructions, children, score, start, session, result, controls }) {
  const activeSession = session
  return <GameFrame gameId={gameId} profile={profile} callbacks={callbacks} instructions={instructions}
    session={activeSession} score={score} onRestart={start} result={result} controls={controls}>{children}</GameFrame>
}

function randomBetween(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

function WhackGame({ profile, callbacks }) {
  const gameId = 'whack-a-mole'
  const session = useSession(gameId, callbacks)
  const [mole, setMole] = useState(-1)
  const [hits, setHits] = useState(0)
  const start = () => { setMole(-1); setHits(0); session.start() }
  useEffect(() => {
    if (session.phase !== 'playing') return undefined
    const timer = window.setInterval(() => setMole(randomBetween(0, 8)), 650)
    return () => window.clearInterval(timer)
  }, [session.phase])
  useEffect(() => {
    if (session.phase === 'playing' && session.elapsed >= 30) session.finish(hits, true)
  }, [hits, session])
  return <Mode gameId={gameId} profile={profile} callbacks={callbacks} session={session} score={hits} start={start}
    instructions="Triff das leuchtende Feld. Du hast 30 Sekunden; jedes Ziel bleibt nur kurz sichtbar."
    controls="KLICKE DAS ZIEL · 30 SEKUNDEN">
    <div className="arcade-whack-grid">{Array.from({ length: 9 }, (_, index) => <button key={index} type="button" className={`arcade-whack-hole${mole === index ? ' mole' : ''}`} onClick={() => { if (session.phase === 'playing' && mole === index) { setHits((value) => value + 1); setMole(-1) } }} aria-label={mole === index ? 'Ziel treffen' : 'Leeres Feld'}>{mole === index ? '✦' : ''}</button>)}</div>
  </Mode>
}

function ReactionGame({ profile, callbacks }) {
  const gameId = 'reaction-time'
  const session = useSession(gameId, callbacks)
  const [signal, setSignal] = useState('idle')
  const [startedAt, setStartedAt] = useState(0)
  const [times, setTimes] = useState([])
  const timeoutRef = useRef(0)
  const start = () => {
    window.clearTimeout(timeoutRef.current)
    setTimes([])
    setSignal('waiting')
    session.start()
    timeoutRef.current = window.setTimeout(() => { setStartedAt(performance.now()); setSignal('go') }, randomBetween(1400, 3600))
  }
  useEffect(() => () => window.clearTimeout(timeoutRef.current), [])
  const react = () => {
    if (signal === 'waiting') { window.clearTimeout(timeoutRef.current); setSignal('false-start'); session.finish(0, false); return }
    if (signal !== 'go') return
    const next = [...times, Math.round(performance.now() - startedAt)]
    setTimes(next)
    if (next.length >= 5) { session.finish(Math.max(0, 1000 - Math.round(next.reduce((a, b) => a + b, 0) / next.length)), true); setSignal('done') }
    else {
      setSignal('waiting')
      timeoutRef.current = window.setTimeout(() => { setStartedAt(performance.now()); setSignal('go') }, randomBetween(1200, 3200))
    }
  }
  return <Mode gameId={gameId} profile={profile} callbacks={callbacks} session={session} score={times.length ? Math.max(0, 1000 - Math.round(times.reduce((a, b) => a + b, 0) / times.length)) : 0} start={start}
    instructions="Klicke erst, wenn das Feld grün wird. Ein verfrühter Klick beendet den Versuch; fünf Reaktionen ergeben deinen Durchschnitt."
    result={signal === 'false-start' ? 'Zu früh!' : signal === 'done' ? 'Test beendet' : undefined}
    controls="KLICKEN, WENN DAS FELD GRÜN IST">
    <button type="button" className={`arcade-reaction-pad ${signal}`} onClick={react}>{signal === 'waiting' ? 'WARTEN …' : signal === 'go' ? 'JETZT!' : signal === 'false-start' ? 'FEHLSTART' : signal === 'done' ? `${Math.round(times.reduce((a, b) => a + b, 0) / Math.max(1, times.length))} ms` : 'BEREIT'}</button>
  </Mode>
}

function AimGame({ profile, callbacks }) {
  const gameId = 'aim-trainer'
  const session = useSession(gameId, callbacks)
  const [hits, setHits] = useState(0)
  const [target, setTarget] = useState({ x: 50, y: 50 })
  const start = () => { setHits(0); setTarget({ x: 50, y: 50 }); session.start() }
  useEffect(() => { if (session.phase === 'playing' && session.elapsed >= 30) session.finish(hits, true) }, [hits, session])
  const moveTarget = () => { setHits((value) => value + 1); setTarget({ x: randomBetween(10, 90), y: randomBetween(10, 90) }) }
  return <Mode gameId={gameId} profile={profile} callbacks={callbacks} session={session} score={hits} start={start}
    instructions="Triff das Ziel so oft du kannst. Nach jedem Treffer springt es an eine neue Stelle."
    controls="ZIEL KLICKEN · 30 SEKUNDEN">
    <div className="arcade-aim-field"><button type="button" className="arcade-aim-target" style={{ left: `${target.x}%`, top: `${target.y}%` }} onClick={moveTarget} aria-label="Ziel treffen" /></div>
  </Mode>
}

function StackGame({ profile, callbacks }) {
  const gameId = 'stack-tower'
  const session = useSession(gameId, callbacks)
  const [blocks, setBlocks] = useState([{ x: 22, width: 56 }])
  const [moving, setMoving] = useState(22)
  const [direction, setDirection] = useState(1)
  const start = () => { setBlocks([{ x: 22, width: 56 }]); setMoving(22); setDirection(1); session.start() }
  useEffect(() => {
    if (session.phase !== 'playing') return undefined
    const timer = window.setInterval(() => setMoving((x) => {
      if (x >= 75) setDirection(-1)
      if (x <= 2) setDirection(1)
      return Math.max(2, Math.min(75, x + direction * 2.2))
    }), 35)
    return () => window.clearInterval(timer)
  }, [direction, session.phase])
  const drop = () => {
    if (session.phase !== 'playing') return
    const base = blocks[blocks.length - 1]
    const left = Math.max(base.x, moving)
    const right = Math.min(base.x + base.width, moving + base.width)
    const width = right - left
    if (width <= 4) { session.finish(blocks.length - 1, false); return }
    const next = [...blocks, { x: left, width }]
    setBlocks(next)
    setMoving(2)
    setDirection(1)
    if (next.length >= 14) session.finish(next.length - 1, true)
  }
  return <Mode gameId={gameId} profile={profile} callbacks={callbacks} session={session} score={blocks.length - 1} start={start}
    instructions="Lass den beweglichen Block fallen. Nur die überlappende Fläche bleibt für den nächsten Stock."
    controls="KLICK / LEERTASTE ZUM STAPELN">
    <div className="arcade-stack-field" tabIndex="0" onClick={drop} onKeyDown={(event) => { if (event.code === 'Space') { event.preventDefault(); drop() } }}>
      {blocks.map((block, index) => <span key={index} className="arcade-stack-block" style={{ left: `${block.x}%`, width: `${block.width}%`, bottom: `${index * 24}px` }} />)}
      {session.phase === 'playing' && <span className="arcade-stack-block moving" style={{ left: `${moving}%`, width: `${blocks[blocks.length - 1].width}%`, bottom: `${blocks.length * 24}px` }} />}
    </div>
  </Mode>
}

const WORDS = ['NEBULA', 'KOMET', 'GALAXIS', 'RAKETE', 'PLANET', 'ORBIT', 'STERN', 'KOSMOS']
function WordScrambleGame({ profile, callbacks }) {
  const gameId = 'word-scramble'
  const session = useSession(gameId, callbacks)
  const [round, setRound] = useState(0)
  const [answer, setAnswer] = useState('')
  const [word, setWord] = useState(WORDS[0])
  const [scrambled, setScrambled] = useState('')
  const [solved, setSolved] = useState(0)
  const scramble = (value) => {
    let letters = value.split('')
    for (let attempt = 0; attempt < 8 && letters.join('') === value; attempt += 1) letters = letters.sort(() => Math.random() - .5)
    return letters.join('')
  }
  const start = () => { const next = WORDS[randomBetween(0, WORDS.length - 1)]; setRound(0); setSolved(0); setAnswer(''); setWord(next); setScrambled(scramble(next)); session.start() }
  const submit = (event) => {
    event.preventDefault()
    if (answer.trim().toLocaleUpperCase('de-DE') !== word) return
    const next = solved + 1
    setSolved(next)
    setAnswer('')
    if (next >= 8) session.finish(next * 100, true)
    else {
      const nextWord = WORDS.filter((candidate) => candidate !== word)[randomBetween(0, WORDS.length - 2)]
      setRound((value) => value + 1)
      setWord(nextWord)
      setScrambled(scramble(nextWord))
    }
  }
  return <Mode gameId={gameId} profile={profile} callbacks={callbacks} session={session} score={solved * 100} start={start}
    instructions="Tippe das Wort aus den Buchstaben. Löse acht Wörter, um die Runde zu gewinnen."
    controls="ANTWORT EINGEBEN UND ENTER DRÜCKEN">
    <div className="arcade-word-game"><span className="section-kicker">WORT {round + 1} / 8</span><strong>{scrambled}</strong><form onSubmit={submit}><input autoComplete="off" value={answer} onChange={(event) => setAnswer(event.target.value)} aria-label="Wortlösung" /><button className="primary-button" disabled={session.phase !== 'playing'}>Prüfen</button></form></div>
  </Mode>
}

function WordGuessGame({ profile, callbacks }) {
  const gameId = 'word-guess'
  const session = useSession(gameId, callbacks)
  const [word, setWord] = useState('')
  const [guessed, setGuessed] = useState([])
  const [mistakes, setMistakes] = useState(0)
  const start = () => { setWord(WORDS[randomBetween(0, WORDS.length - 1)]); setGuessed([]); setMistakes(0); session.start() }
  const guess = (letter) => {
    if (session.phase !== 'playing' || guessed.includes(letter)) return
    const next = [...guessed, letter]
    setGuessed(next)
    const miss = mistakes + Number(!word.includes(letter))
    if (!word.includes(letter)) setMistakes(miss)
    if (word.split('').every((item) => next.includes(item))) session.finish(Math.max(100, 1000 - miss * 100), true)
    else if (miss >= 6) session.finish(0, false)
  }
  return <Mode gameId={gameId} profile={profile} callbacks={callbacks} session={session} score={Math.max(0, 1000 - mistakes * 100)} start={start}
    instructions="Errate das Wort Buchstabe für Buchstabe. Nach sechs falschen Buchstaben ist der Versuch vorbei."
    controls="BUCHSTABEN ANKLICKEN ODER TASTATUR VERWENDEN">
    <div className="arcade-word-guess"><strong>{word.split('').map((letter) => guessed.includes(letter) ? letter : '＿').join(' ')}</strong><div>{'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => <button type="button" key={letter} disabled={session.phase !== 'playing' || guessed.includes(letter)} onClick={() => guess(letter)}>{letter}</button>)}</div><small>Fehler: {mistakes} / 6</small></div>
  </Mode>
}

function LightsOutGame({ profile, callbacks }) {
  const gameId = 'lights-out'
  const session = useSession(gameId, callbacks)
  const [lights, setLights] = useState(Array(25).fill(false))
  const [moves, setMoves] = useState(0)
  const start = () => {
    const board = Array(25).fill(false)
    for (let turn = 0; turn < 13; turn += 1) toggleLight(board, randomBetween(0, 24))
    setLights(board)
    setMoves(0)
    session.start()
  }
  const press = (index) => {
    if (session.phase !== 'playing') return
    const next = [...lights]
    toggleLight(next, index)
    setLights(next)
    setMoves((value) => value + 1)
    if (next.every((value) => !value)) session.finish(Math.max(100, 1000 - moves * 15), true)
  }
  return <Mode gameId={gameId} profile={profile} callbacks={callbacks} session={session} score={Math.max(0, 1000 - moves * 15)} start={start}
    instructions="Jeder Druck schaltet das Feld sowie seine horizontalen und vertikalen Nachbarn um. Schalte alle Lichter aus."
    controls="FELDER KLICKEN ODER PFEILTASTEN">
    <div className="arcade-lights-grid">{lights.map((on, index) => <button type="button" key={index} className={on ? 'on' : ''} onClick={() => press(index)} aria-label={`Licht ${index + 1} ${on ? 'an' : 'aus'}`} />)}</div>
  </Mode>
}
function toggleLight(board, index) {
  const row = Math.floor(index / 5)
  const col = index % 5
  for (const [r, c] of [[row, col], [row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]) {
    if (r >= 0 && r < 5 && c >= 0 && c < 5) board[r * 5 + c] = !board[r * 5 + c]
  }
}

const SOKOBAN_MAP = [
  '########',
  '#..#...#',
  '#..$...#',
  '#.$#.#.#',
  '#..#.#.#',
  '#..@...#',
  '#...$..#',
  '########',
]
const SOKOBAN_GOALS = new Set([9, 14, 41])
function parseSokoban() {
  const walls = new Set()
  const boxes = []
  let player = 0
  SOKOBAN_MAP.join('').split('').forEach((tile, index) => {
    if (tile === '#') walls.add(index)
    if (tile === '$') boxes.push(index)
    if (tile === '@') player = index
  })
  return { walls, boxes, player }
}
function SokobanGame({ profile, callbacks }) {
  const gameId = 'sokoban'
  const session = useSession(gameId, callbacks)
  const [board, setBoard] = useState(parseSokoban)
  const [moves, setMoves] = useState(0)
  const start = () => { setBoard(parseSokoban()); setMoves(0); session.start() }
  const move = (delta) => {
    if (session.phase !== 'playing') return
    const target = board.player + delta
    if (board.walls.has(target)) return
    const boxes = [...board.boxes]
    const boxIndex = boxes.indexOf(target)
    if (boxIndex >= 0) {
      const beyond = target + delta
      if (board.walls.has(beyond) || boxes.includes(beyond)) return
      boxes[boxIndex] = beyond
    }
    const next = { ...board, boxes, player: target }
    setBoard(next)
    setMoves((value) => value + 1)
    if (boxes.every((box) => SOKOBAN_GOALS.has(box))) session.finish(Math.max(100, 1500 - moves * 10), true)
  }
  const handleKey = (event) => {
    const delta = { ArrowUp: -8, ArrowDown: 8, ArrowLeft: -1, ArrowRight: 1 }[event.key]
    if (delta) { event.preventDefault(); move(delta) }
  }
  return <Mode gameId={gameId} profile={profile} callbacks={callbacks} session={session} score={Math.max(0, 1500 - moves * 10)} start={start}
    instructions="Schiebe alle drei Kisten auf die Zielfelder. Kisten können nicht gezogen werden."
    controls="PFEILTASTEN ZUM BEWEGEN">
    <div className="arcade-sokoban-board" onKeyDown={handleKey} tabIndex="0">{SOKOBAN_MAP.join('').split('').map((tile, index) => <span key={index} className={`${tile === '#' ? 'wall ' : ''}${board.player === index ? 'player ' : ''}${board.boxes.includes(index) ? 'box ' : ''}${SOKOBAN_GOALS.has(index) ? 'goal' : ''}`}>{board.player === index ? '●' : board.boxes.includes(index) ? '■' : SOKOBAN_GOALS.has(index) ? '◆' : ''}</span>)}</div>
  </Mode>
}

function HanoiGame({ profile, callbacks }) {
  const gameId = 'tower-of-hanoi'
  const session = useSession(gameId, callbacks)
  const [towers, setTowers] = useState([[4, 3, 2, 1], [], []])
  const [selected, setSelected] = useState(-1)
  const [moves, setMoves] = useState(0)
  const start = () => { setTowers([[4, 3, 2, 1], [], []]); setSelected(-1); setMoves(0); session.start() }
  const choose = (index) => {
    if (session.phase !== 'playing') return
    if (selected < 0) { if (towers[index].length) setSelected(index); return }
    if (selected === index) { setSelected(-1); return }
    const from = [...towers[selected]]
    const to = [...towers[index]]
    const disk = from[from.length - 1]
    if (to.length && to[to.length - 1] < disk) { setSelected(-1); return }
    from.pop(); to.push(disk)
    const next = towers.map((tower, towerIndex) => towerIndex === selected ? from : towerIndex === index ? to : tower)
    setTowers(next); setMoves((value) => value + 1); setSelected(-1)
    if (to.length === 4) session.finish(Math.max(100, 1000 - moves * 20), true)
  }
  return <Mode gameId={gameId} profile={profile} callbacks={callbacks} session={session} score={Math.max(0, 1000 - moves * 20)} start={start}
    instructions="Bewege alle vier Scheiben auf den rechten Turm. Immer nur die oberste Scheibe darf bewegt werden."
    controls="TURM ZUM AUFNEHMEN UND ZIELTURM ZUM ABLEGEN KLICKEN">
    <div className="arcade-hanoi">{towers.map((tower, index) => <button type="button" className={`arcade-hanoi-peg${selected === index ? ' selected' : ''}`} key={index} onClick={() => choose(index)}><span className="tower-base" />{tower.map((disk) => <i key={disk} style={{ width: `${30 + disk * 18}%` }} />)}</button>)}</div>
  </Mode>
}

function NumberSlideGame({ profile, callbacks }) {
  const gameId = 'number-slide'
  const session = useSession(gameId, callbacks)
  const [tiles, setTiles] = useState(Array.from({ length: 16 }, (_, index) => index ? index : 0))
  const [moves, setMoves] = useState(0)
  const start = () => {
    const board = Array.from({ length: 16 }, (_, index) => index ? index : 0)
    for (let turn = 0; turn < 150; turn += 1) {
      const empty = board.indexOf(0)
      const options = [empty - 4, empty + 4, empty % 4 ? empty - 1 : -1, empty % 4 < 3 ? empty + 1 : -1].filter((value) => value >= 0 && value < 16)
      const index = options[randomBetween(0, options.length - 1)]
      ;[board[empty], board[index]] = [board[index], board[empty]]
    }
    setTiles(board); setMoves(0); session.start()
  }
  const shift = (index) => {
    if (session.phase !== 'playing') return
    const empty = tiles.indexOf(0)
    if (Math.abs(Math.floor(empty / 4) - Math.floor(index / 4)) + Math.abs(empty % 4 - index % 4) !== 1) return
    const next = [...tiles]; [next[empty], next[index]] = [next[index], next[empty]]
    setTiles(next); setMoves((value) => value + 1)
    if (next.every((value, position) => value === (position ? position : 0))) session.finish(Math.max(100, 1000 - moves * 5), true)
  }
  const handleKey = (event) => {
    const empty = tiles.indexOf(0)
    const index = { ArrowUp: empty + 4, ArrowDown: empty - 4, ArrowLeft: empty % 4 < 3 ? empty + 1 : -1, ArrowRight: empty % 4 ? empty - 1 : -1 }[event.key]
    if (index !== undefined) { event.preventDefault(); if (index >= 0 && index < 16) shift(index) }
  }
  return <Mode gameId={gameId} profile={profile} callbacks={callbacks} session={session} score={Math.max(0, 1000 - moves * 5)} start={start}
    instructions="Schiebe die Kacheln in aufsteigende Reihenfolge. Eine Kachel neben der Lücke lässt sich bewegen."
    controls="KACHEL KLICKEN ODER PFEILTASTEN">
    <div className="arcade-slide-board" onKeyDown={handleKey} tabIndex="0">{tiles.map((value, index) => <button type="button" key={index} disabled={!value || session.phase !== 'playing'} onClick={() => shift(index)}>{value || ''}</button>)}</div>
  </Mode>
}

const CONNECT_ROWS = 6
const CONNECT_COLS = 7
function connectWinner(board, token) {
  for (let row = 0; row < CONNECT_ROWS; row += 1) {
    for (let col = 0; col < CONNECT_COLS; col += 1) {
      if (board[row * CONNECT_COLS + col] !== token) continue
      for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
        let count = 1
        for (let step = 1; step < 4; step += 1) {
          const r = row + dr * step
          const c = col + dc * step
          if (r < 0 || r >= CONNECT_ROWS || c < 0 || c >= CONNECT_COLS || board[r * CONNECT_COLS + c] !== token) break
          count += 1
        }
        if (count === 4) return true
      }
    }
  }
  return false
}
function dropConnect(board, column, token) {
  const next = [...board]
  for (let row = CONNECT_ROWS - 1; row >= 0; row -= 1) {
    const index = row * CONNECT_COLS + column
    if (!next[index]) { next[index] = token; return next }
  }
  return null
}
function chooseConnectColumn(board) {
  const valid = Array.from({ length: CONNECT_COLS }, (_, col) => col).filter((col) => !board[col])
  for (const token of ['O', 'X']) {
    for (const col of valid) {
      const attempt = dropConnect(board, col, token)
      if (attempt && connectWinner(attempt, token)) return col
    }
  }
  return valid.sort((a, b) => Math.abs(a - 3) - Math.abs(b - 3))[0]
}
function ConnectFourGame({ profile, callbacks }) {
  const gameId = 'connect-four'
  const session = useSession(gameId, callbacks)
  const [board, setBoard] = useState(Array(CONNECT_ROWS * CONNECT_COLS).fill(''))
  const [thinking, setThinking] = useState(false)
  const [result, setResult] = useState('')
  const turnRef = useRef(0)
  const start = () => { turnRef.current += 1; setBoard(Array(CONNECT_ROWS * CONNECT_COLS).fill('')); setThinking(false); setResult(''); session.start() }
  const play = (column) => {
    if (session.phase !== 'playing' || thinking) return
    const next = dropConnect(board, column, 'X')
    if (!next) return
    setBoard(next)
    if (connectWinner(next, 'X')) { setResult('Du hast vier verbunden!'); session.finish(1000, true); return }
    if (next.every(Boolean)) { setResult('Unentschieden'); session.finish(250, false); return }
    setThinking(true)
    const turn = turnRef.current
    window.setTimeout(() => {
      if (turn !== turnRef.current) return
      const ai = dropConnect(next, chooseConnectColumn(next), 'O') ?? next
      setBoard(ai)
      setThinking(false)
      if (connectWinner(ai, 'O')) { setResult('Die Vexlor-KI gewinnt.'); session.finish(0, false) }
      else if (ai.every(Boolean)) { setResult('Unentschieden'); session.finish(250, false) }
    }, 280)
  }
  return <Mode gameId={gameId} profile={profile} callbacks={callbacks} session={session} score={result.startsWith('Du') ? 1000 : 0} start={start} result={result || undefined}
    instructions="Lass deinen Spielstein in eine Spalte fallen. Verbinde vier in einer Reihe, bevor es die KI schafft."
    controls="SPALTE ANKLICKEN · GELB GEGEN VIOLETT">
    <div className="arcade-connect-board">{Array.from({ length: CONNECT_COLS }, (_, col) => <button key={col} className="arcade-connect-column" type="button" aria-label={`Spalte ${col + 1}`} onClick={() => play(col)}>{Array.from({ length: CONNECT_ROWS }, (_, row) => { const token = board[row * CONNECT_COLS + col]; return <i key={row} className={token.toLowerCase()} /> })}</button>)}</div>
  </Mode>
}

const CODE_COLORS = ['#ff6b7b', '#ffcc66', '#45d8a2', '#55b6ff', '#a88bff', '#f58be2']
function MastermindGame({ profile, callbacks }) {
  const gameId = 'mastermind'
  const session = useSession(gameId, callbacks)
  const [secret, setSecret] = useState([])
  const [guess, setGuess] = useState([])
  const [attempts, setAttempts] = useState([])
  const [message, setMessage] = useState('')
  const start = () => { setSecret(Array.from({ length: 4 }, () => randomBetween(0, CODE_COLORS.length - 1))); setGuess([]); setAttempts([]); setMessage(''); session.start() }
  const submit = () => {
    if (guess.length !== 4) return
    let exact = 0
    const remainingSecret = []
    const remainingGuess = []
    secret.forEach((value, index) => {
      if (guess[index] === value) exact += 1
      else { remainingSecret.push(value); remainingGuess.push(guess[index]) }
    })
    const colorOnly = remainingGuess.reduce((count, value) => {
      const index = remainingSecret.indexOf(value)
      if (index < 0) return count
      remainingSecret.splice(index, 1)
      return count + 1
    }, 0)
    const next = [...attempts, { guess, exact, colorOnly }]
    setAttempts(next); setGuess([])
    if (exact === 4) { setMessage('Code geknackt!'); session.finish(Math.max(100, 1000 - attempts.length * 100), true) }
    else if (next.length >= 8) { setMessage('Versuche aufgebraucht.'); session.finish(0, false) }
  }
  return <Mode gameId={gameId} profile={profile} callbacks={callbacks} session={session} score={attempts.length ? 1000 - attempts.length * 100 : 0} start={start} result={message || undefined}
    instructions="Finde den geheimen vierfarbigen Code. Punkte zeigen richtige Farbe und Position; kleine Punkte zeigen richtige Farbe an falscher Stelle."
    controls="FARBE ANKLICKEN · ENTER ZUM PRÜFEN">
    <div className="arcade-mastermind">
      {attempts.map((attempt, index) => <div className="arcade-master-row" key={index}><span>{attempt.guess.map((color, i) => <i key={i} style={{ background: CODE_COLORS[color] }} />)}</span><small>{attempt.exact} exakt · {attempt.colorOnly} Farbe</small></div>)}
      <div className="arcade-master-current">{Array.from({ length: 4 }, (_, index) => <button type="button" key={index} style={{ background: guess[index] === undefined ? undefined : CODE_COLORS[guess[index]] }} onClick={() => setGuess((current) => current.filter((_, i) => i !== index))} aria-label={`Farbposition ${index + 1}`} />)}</div>
      <div className="arcade-master-palette">{CODE_COLORS.map((color, index) => <button type="button" key={color} style={{ background: color }} onClick={() => { if (guess.length < 4) setGuess((current) => [...current, index]) }} aria-label={`Farbe ${index + 1}`} />)}<button type="button" onClick={submit} disabled={guess.length !== 4}>Prüfen</button></div>
    </div>
  </Mode>
}

const QUESTION_BANKS = {
  'quiz-challenge': [
    { q: 'Wie viele Seiten hat ein Hexagon?', a: ['5', '6', '7', '8'], correct: 1 },
    { q: 'Welcher Planet ist der Sonne am nächsten?', a: ['Venus', 'Mars', 'Merkur', 'Erde'], correct: 2 },
    { q: 'Wie heißt die Hauptstadt von Japan?', a: ['Seoul', 'Tokio', 'Peking', 'Bangkok'], correct: 1 },
    { q: 'Welches Gas nehmen Pflanzen hauptsächlich auf?', a: ['Sauerstoff', 'Stickstoff', 'Kohlendioxid', 'Helium'], correct: 2 },
    { q: 'Wie viele Minuten hat eine Stunde?', a: ['50', '60', '70', '100'], correct: 1 },
  ],
  'geography-quiz': [
    { q: 'Hauptstadt von Kanada?', a: ['Toronto', 'Ottawa', 'Vancouver', 'Montreal'], correct: 1 },
    { q: 'Hauptstadt von Australien?', a: ['Sydney', 'Canberra', 'Melbourne', 'Perth'], correct: 1 },
    { q: 'Welcher Fluss fließt durch Kairo?', a: ['Nil', 'Amazonas', 'Donau', 'Rhein'], correct: 0 },
    { q: 'Welches Land hat die Form eines Stiefels?', a: ['Spanien', 'Italien', 'Griechenland', 'Portugal'], correct: 1 },
    { q: 'Auf welchem Kontinent liegt die Atacama-Wüste?', a: ['Afrika', 'Asien', 'Südamerika', 'Europa'], correct: 2 },
  ],
  'flag-quiz': [
    { q: '🇯🇵 Zu welchem Land gehört diese Flagge?', a: ['China', 'Japan', 'Südkorea', 'Vietnam'], correct: 1 },
    { q: '🇨🇦 Zu welchem Land gehört diese Flagge?', a: ['Kanada', 'Dänemark', 'Österreich', 'Peru'], correct: 0 },
    { q: '🇧🇷 Zu welchem Land gehört diese Flagge?', a: ['Portugal', 'Argentinien', 'Brasilien', 'Mexiko'], correct: 2 },
    { q: '🇸🇪 Zu welchem Land gehört diese Flagge?', a: ['Norwegen', 'Finnland', 'Island', 'Schweden'], correct: 3 },
    { q: '🇬🇷 Zu welchem Land gehört diese Flagge?', a: ['Griechenland', 'Israel', 'Uruguay', 'Chile'], correct: 0 },
  ],
}
function QuizGame({ gameId, profile, callbacks }) {
  const session = useSession(gameId, callbacks)
  const bank = QUESTION_BANKS[gameId]
  const [questionIndex, setQuestionIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [feedback, setFeedback] = useState('')
  const start = () => { setQuestionIndex(0); setScore(0); setFeedback(''); session.start() }
  const answer = (index) => {
    if (session.phase !== 'playing' || feedback) return
    const correct = index === bank[questionIndex].correct
    const points = score + Number(correct) * 100
    setScore(points)
    setFeedback(correct ? 'Richtig!' : 'Leider falsch')
    window.setTimeout(() => {
      if (questionIndex + 1 >= bank.length) { session.finish(points, points === bank.length * 100); return }
      setQuestionIndex((value) => value + 1)
      setFeedback('')
    }, 550)
  }
  return <Mode gameId={gameId} profile={profile} callbacks={callbacks} session={session} score={score} start={start}
    instructions="Wähle die richtige Antwort. Jede richtige Antwort gibt 100 Punkte."
    controls="ANTWORT ANKLICKEN">
    <div className="arcade-quiz"><span className="section-kicker">FRAGE {questionIndex + 1} / {bank.length}</span><h2>{bank[questionIndex].q}</h2><div>{bank[questionIndex].a.map((answerText, index) => <button type="button" key={answerText} onClick={() => answer(index)}>{answerText}</button>)}</div><strong>{feedback}</strong></div>
  </Mode>
}

function QuickMathGame({ profile, callbacks }) {
  const gameId = 'quick-math'
  const session = useSession(gameId, callbacks)
  const [problem, setProblem] = useState({ a: 2, b: 3, answer: 5 })
  const [input, setInput] = useState('')
  const [correct, setCorrect] = useState(0)
  const nextProblem = () => {
    const a = randomBetween(2, 20)
    const b = randomBetween(2, 12)
    const multiply = Math.random() > .5
    setProblem({ a, b, answer: multiply ? a * b : a + b, op: multiply ? '×' : '+' })
  }
  const start = () => { setCorrect(0); setInput(''); nextProblem(); session.start() }
  const submit = (event) => {
    event.preventDefault()
    if (Number(input) === problem.answer) {
      const next = correct + 1
      setCorrect(next); setInput('')
      if (next >= 10) session.finish(1000, true)
      else nextProblem()
    } else setInput('')
  }
  return <Mode gameId={gameId} profile={profile} callbacks={callbacks} session={session} score={correct * 100} start={start}
    instructions="Löse zehn Additions- oder Multiplikationsaufgaben. Falsche Antworten zählen nicht als Punkt."
    controls="ANTWORT TIPPEN UND ENTER">
    <form className="arcade-math" onSubmit={submit}><span>{problem.a} {problem.op} {problem.b} = ?</span><input type="number" value={input} onChange={(event) => setInput(event.target.value)} aria-label="Ergebnis" autoFocus /><small>{correct} / 10 richtig</small></form>
  </Mode>
}

const TYPING_LINES = [
  'Neonlichter weisen den Weg durch die Nacht.',
  'Schnelle Finger bringen den nächsten Rekord.',
  'Kleine Schritte führen zum großen Ziel.',
]
function TypingGame({ profile, callbacks }) {
  const gameId = 'typing-speed'
  const session = useSession(gameId, callbacks)
  const [line, setLine] = useState(TYPING_LINES[0])
  const [typed, setTyped] = useState('')
  const start = () => { setLine(TYPING_LINES[randomBetween(0, TYPING_LINES.length - 1)]); setTyped(''); session.start() }
  const score = Math.round(typed.trim().split(/\s+/).filter(Boolean).length / Math.max(session.elapsed / 60, .1))
  useEffect(() => { if (session.phase === 'playing' && session.elapsed >= 60) session.finish(score, true) }, [score, session])
  return <Mode gameId={gameId} profile={profile} callbacks={callbacks} session={session} score={score} start={start}
    instructions="Tippe den Satz ab. Falsche Zeichen werden markiert; die Runde endet nach 60 Sekunden."
    controls="SATZ ABTIPPEN · 60 SEKUNDEN">
    <div className="arcade-typing"><p>{line.split('').map((character, index) => <span key={index} className={typed[index] === undefined ? '' : typed[index] === character ? 'correct' : 'incorrect'}>{character}</span>)}</p><input value={typed} onChange={(event) => setTyped(event.target.value)} onPaste={(event) => event.preventDefault()} aria-label="Text abtippen" autoComplete="off" /></div>
  </Mode>
}

const NAMED_COLORS = [
  { label: 'ROT', color: '#ff6577' }, { label: 'BLAU', color: '#5ea2ff' },
  { label: 'GRÜN', color: '#53d69c' }, { label: 'GELB', color: '#ffd35c' },
]
function ColorMatchGame({ profile, callbacks }) {
  const gameId = 'color-match'
  const session = useSession(gameId, callbacks)
  const [round, setRound] = useState({ word: 0, ink: 0 })
  const [points, setPoints] = useState(0)
  const [turn, setTurn] = useState(0)
  const next = () => setRound({ word: randomBetween(0, 3), ink: randomBetween(0, 3) })
  const start = () => { setPoints(0); setTurn(0); next(); session.start() }
  const answer = (matches) => {
    if (session.phase !== 'playing') return
    const earned = points + Number(matches === (round.word === round.ink)) * 100
    const nextTurn = turn + 1
    setPoints(earned); setTurn(nextTurn)
    if (nextTurn >= 15) session.finish(earned, earned === 1500)
    else next()
  }
  return <Mode gameId={gameId} profile={profile} callbacks={callbacks} session={session} score={points} start={start}
    instructions="Lies das Wort und prüfe seine Schriftfarbe. Entscheide, ob die Bedeutung des Wortes zur Tintenfarbe passt."
    controls="JA / NEIN ANKLICKEN · 15 RUNDEN">
    <div className="arcade-color-match"><span className="section-kicker">RUNDE {turn + 1} / 15</span><strong style={{ color: NAMED_COLORS[round.ink].color }}>{NAMED_COLORS[round.word].label}</strong><div><button type="button" onClick={() => answer(true)}>Stimmt überein</button><button type="button" onClick={() => answer(false)}>Stimmt nicht</button></div></div>
  </Mode>
}

function SimonGame({ profile, callbacks }) {
  const gameId = 'simon-says'
  const session = useSession(gameId, callbacks)
  const [sequence, setSequence] = useState([])
  const [position, setPosition] = useState(0)
  const [lit, setLit] = useState(-1)
  const [waiting, setWaiting] = useState(false)
  const timerRef = useRef(0)
  const start = () => { setSequence([randomBetween(0, 3)]); setPosition(0); setLit(-1); setWaiting(true); session.start() }
  useEffect(() => {
    if (!waiting || session.phase !== 'playing') return undefined
    let index = 0
    const show = () => {
      if (index >= sequence.length) { setLit(-1); setWaiting(false); setPosition(0); return }
      setLit(sequence[index])
      timerRef.current = window.setTimeout(() => { setLit(-1); index += 1; timerRef.current = window.setTimeout(show, 220) }, 430)
    }
    timerRef.current = window.setTimeout(show, 350)
    return () => window.clearTimeout(timerRef.current)
  }, [sequence, session.phase, waiting])
  useEffect(() => () => window.clearTimeout(timerRef.current), [])
  const press = (index) => {
    if (session.phase !== 'playing' || waiting) return
    if (sequence[position] !== index) { session.finish(Math.max(0, sequence.length - 1), false); return }
    if (position === sequence.length - 1) { const next = [...sequence, randomBetween(0, 3)]; setSequence(next); setPosition(0); setWaiting(true) }
    else setPosition(position + 1)
  }
  return <Mode gameId={gameId} profile={profile} callbacks={callbacks} session={session} score={Math.max(0, sequence.length - 1)} start={start}
    instructions="Beobachte die Farbfolge und wiederhole sie. Jede Runde fügt ein Feld hinzu."
    controls="FARBEN ANKLICKEN">
    <div className="arcade-simon">{['#fa6681', '#f3ce63', '#55d7aa', '#658dff'].map((color, index) => <button key={color} type="button" style={{ backgroundColor: color }} className={lit === index ? 'lit' : ''} disabled={waiting || session.phase !== 'playing'} onClick={() => press(index)} aria-label={`Farbe ${index + 1}`} />)}</div>
  </Mode>
}

function RpsGame({ profile, callbacks }) {
  const gameId = 'rock-paper-scissors'
  const session = useSession(gameId, callbacks)
  const options = ['✊', '✋', '✌']
  const [wins, setWins] = useState(0)
  const [losses, setLosses] = useState(0)
  const [last, setLast] = useState('')
  const start = () => { setWins(0); setLosses(0); setLast(''); session.start() }
  const play = (choice) => {
    if (session.phase !== 'playing') return
    const computer = randomBetween(0, 2)
    const result = choice === computer ? 0 : (choice - computer + 3) % 3 === 1 ? 1 : -1
    const nextWins = wins + Number(result > 0)
    const nextLosses = losses + Number(result < 0)
    setWins(nextWins); setLosses(nextLosses); setLast(`${options[choice]} gegen ${options[computer]} · ${result > 0 ? 'Sieg' : result < 0 ? 'Niederlage' : 'Gleichstand'}`)
    if (nextWins >= 3 || nextLosses >= 3) session.finish(nextWins * 100, nextWins >= 3)
  }
  return <Mode gameId={gameId} profile={profile} callbacks={callbacks} session={session} score={wins * 100} start={start}
    instructions="Spiele bis drei Siege oder Niederlagen. Stein schlägt Schere, Schere schlägt Papier und Papier schlägt Stein."
    controls="STEIN · PAPIER · SCHERE WÄHLEN">
    <div className="arcade-rps"><p>{last || `${wins} Siege – ${losses} Niederlagen`}</p><div>{options.map((symbol, index) => <button type="button" key={symbol} disabled={session.phase !== 'playing'} onClick={() => play(index)}>{symbol}</button>)}</div></div>
  </Mode>
}

function PongGame({ profile, callbacks }) {
  const gameId = 'pong'
  const session = useSession(gameId, callbacks)
  const gameRef = useRef({ x: 320, y: 180, vx: 4, vy: 2, player: 140, computer: 140, score: 0, cpu: 0 })
  const [game, setGame] = useState(gameRef.current)
  const inputRef = useRef(0)
  const start = () => {
    gameRef.current = { x: 320, y: 180, vx: 4, vy: 2, player: 140, computer: 140, score: 0, cpu: 0 }
    setGame(gameRef.current); inputRef.current = 0; session.start()
  }
  useEffect(() => {
    if (session.phase !== 'playing') return undefined
    const timer = window.setInterval(() => {
      const current = gameRef.current
      current.player = Math.max(0, Math.min(290, current.player + inputRef.current * 7))
      current.computer += Math.sign(current.y - (current.computer + 40)) * Math.min(4.2, Math.abs(current.y - (current.computer + 40)) * .08)
      current.x += current.vx; current.y += current.vy
      if (current.y < 7 || current.y > 353) current.vy *= -1
      if (current.vx < 0 && current.x < 32 && current.y >= current.player && current.y <= current.player + 80) current.vx = Math.abs(current.vx) * 1.04
      if (current.vx > 0 && current.x > 608 && current.y >= current.computer && current.y <= current.computer + 80) current.vx = -Math.abs(current.vx) * 1.04
      if (current.x < -5 || current.x > 645) {
        if (current.x > 645) current.score += 1
        else current.cpu += 1
        if (current.score >= 5 || current.cpu >= 5) { session.finish(current.score * 200, current.score >= 5); return }
        current.x = 320; current.y = 180; current.vx = current.cpu > current.score ? 4 : -4; current.vy = randomBetween(-3, 3) || 2
      }
      setGame({ ...current })
    }, 16)
    return () => window.clearInterval(timer)
  }, [session.phase, session.finish])
  const key = (event) => {
    if (['ArrowUp', 'w', 'W'].includes(event.key)) { inputRef.current = -1; event.preventDefault() }
    if (['ArrowDown', 's', 'S'].includes(event.key)) { inputRef.current = 1; event.preventDefault() }
  }
  const keyUp = () => { inputRef.current = 0 }
  return <Mode gameId={gameId} profile={profile} callbacks={callbacks} session={session} score={game.score * 200} start={start}
    instructions="Bewege deinen Schläger mit W/S oder den Pfeiltasten. Der Computer verteidigt die andere Seite; fünf Punkte gewinnen."
    controls="W/S ODER ↑/↓ BEWEGEN · MAUS IM FELD">
    <div className="arcade-pong-field" onKeyDown={key} onKeyUp={keyUp} onBlur={keyUp} tabIndex="0" onPointerMove={(event) => {
      const bounds = event.currentTarget.getBoundingClientRect()
      gameRef.current.player = Math.max(0, Math.min(290, (event.clientY - bounds.top) * 360 / bounds.height - 40))
    }}>
      <span className="arcade-pong-center" /><span className="arcade-pong-paddle" style={{ top: `${game.player / 360 * 100}%` }} />
      <span className="arcade-pong-paddle cpu" style={{ top: `${game.computer / 360 * 100}%` }} />
      <span className="arcade-pong-ball" style={{ left: `${game.x / 640 * 100}%`, top: `${game.y / 360 * 100}%` }} />
      <strong className="arcade-pong-score">{game.score} : {game.cpu}</strong>
    </div>
  </Mode>
}

function BreakoutGame({ profile, callbacks }) {
  const gameId = 'breakout'
  const session = useSession(gameId, callbacks)
  const gameRef = useRef(null)
  const [game, setGame] = useState({ ballX: 320, ballY: 300, paddle: 270, bricks: Array(40).fill(true), score: 0, lives: 3 })
  const start = () => {
    const next = { ballX: 320, ballY: 300, vx: 3.2, vy: -4, paddle: 270, bricks: Array(40).fill(true), score: 0, lives: 3 }
    gameRef.current = next; setGame({ ...next }); session.start()
  }
  useEffect(() => {
    if (session.phase !== 'playing') return undefined
    const timer = window.setInterval(() => {
      const current = gameRef.current
      if (!current) return
      current.ballX += current.vx; current.ballY += current.vy
      if (current.ballX < 7 || current.ballX > 633) current.vx *= -1
      if (current.ballY < 7) current.vy = Math.abs(current.vy)
      if (current.ballY > 325 && current.ballY < 344 && current.ballX > current.paddle && current.ballX < current.paddle + 100) {
        current.vy = -Math.abs(current.vy); current.vx += (current.ballX - current.paddle - 50) * .035
      }
      if (current.ballY > 370) {
        current.lives -= 1; current.ballX = 320; current.ballY = 300; current.vy = -4
        if (current.lives <= 0) { session.finish(current.score, false); return }
      }
      const column = Math.floor((current.ballX - 20) / 75)
      const row = Math.floor((current.ballY - 30) / 22)
      const brickIndex = row * 8 + column
      if (row >= 0 && row < 5 && column >= 0 && column < 8 && current.bricks[brickIndex]) {
        current.bricks[brickIndex] = false; current.score += 10; current.vy *= -1
        if (current.bricks.every((brick) => !brick)) session.finish(current.score + current.lives * 50, true)
      }
      setGame({ ...current })
    }, 16)
    return () => window.clearInterval(timer)
  }, [session.finish, session.phase])
  const movePaddle = (event) => {
    if (!gameRef.current) return
    const bounds = event.currentTarget.getBoundingClientRect()
    gameRef.current.paddle = Math.max(0, Math.min(540, (event.clientX - bounds.left) * 640 / bounds.width - 50))
  }
  return <Mode gameId={gameId} profile={profile} callbacks={callbacks} session={session} score={game.score} start={start}
    instructions="Bewege den Schläger mit der Maus oder den Pfeiltasten und halte den Ball im Feld, bis alle Blöcke zerstört sind."
    controls="MAUS ODER PFEILTASTEN · 3 LEBEN">
    <div className="arcade-breakout-field" onPointerMove={movePaddle} onKeyDown={(event) => { if (!gameRef.current) return; if (event.key === 'ArrowLeft') gameRef.current.paddle = Math.max(0, gameRef.current.paddle - 25); if (event.key === 'ArrowRight') gameRef.current.paddle = Math.min(540, gameRef.current.paddle + 25) }} tabIndex="0">
      {game.bricks.map((active, index) => active && <i key={index} className={`brick brick-${Math.floor(index / 8)}`} style={{ left: `${(20 + (index % 8) * 75) / 640 * 100}%`, top: `${(30 + Math.floor(index / 8) * 22) / 360 * 100}%` }} />)}
      <span className="arcade-breakout-paddle" style={{ left: `${game.paddle / 640 * 100}%` }} />
      <span className="arcade-breakout-ball" style={{ left: `${game.ballX / 640 * 100}%`, top: `${game.ballY / 360 * 100}%` }} />
      <strong className="arcade-breakout-lives">● {game.lives}</strong>
    </div>
  </Mode>
}

function FlappyGame({ profile, callbacks }) {
  const gameId = 'flappy'
  const session = useSession(gameId, callbacks)
  const gameRef = useRef({ y: 170, velocity: 0, pipeX: 550, gap: 175, score: 0 })
  const [game, setGame] = useState(gameRef.current)
  const start = () => { gameRef.current = { y: 170, velocity: 0, pipeX: 550, gap: randomBetween(120, 225), score: 0 }; setGame({ ...gameRef.current }); session.start() }
  useEffect(() => {
    if (session.phase !== 'playing') return undefined
    const timer = window.setInterval(() => {
      const current = gameRef.current
      current.velocity += .32; current.y += current.velocity; current.pipeX -= 3
      if (current.pipeX < -55) { current.pipeX = 660; current.gap = randomBetween(110, 230); current.score += 1 }
      if (current.y < 0 || current.y > 350 || (current.pipeX < 102 && current.pipeX > 35 && (current.y < current.gap - 46 || current.y > current.gap + 46))) {
        session.finish(current.score, false); return
      }
      setGame({ ...current })
    }, 20)
    return () => window.clearInterval(timer)
  }, [session.finish, session.phase])
  const flap = () => { if (session.phase === 'playing') { gameRef.current.velocity = -5.7 } }
  return <Mode gameId={gameId} profile={profile} callbacks={callbacks} session={session} score={game.score} start={start}
    instructions="Klicke oder drücke die Leertaste, um zu flattern. Fliege durch die Lücken und berühre keine Röhren."
    controls="KLICK / LEERTASTE ZUM FLATTERN">
    <div className="arcade-flappy-field" onPointerDown={flap} onKeyDown={(event) => { if (event.code === 'Space') { event.preventDefault(); flap() } }} tabIndex="0">
      <span className="arcade-flappy-bird" style={{ top: `${game.y / 360 * 100}%` }}>✦</span>
      <i className="arcade-flappy-pipe top" style={{ left: `${game.pipeX / 640 * 100}%`, height: `${(game.gap - 46) / 360 * 100}%` }} />
      <i className="arcade-flappy-pipe bottom" style={{ left: `${game.pipeX / 640 * 100}%`, top: `${(game.gap + 46) / 360 * 100}%` }} />
      <strong>{game.score}</strong>
    </div>
  </Mode>
}

const BUBBLE_COLORS = ['#ff6d8b', '#64b9ff', '#ffd166', '#5bd7a2', '#b08aff']
function createBubbleBoard() {
  return Array.from({ length: 6 }, (_, row) => Array.from({ length: 8 }, () => row < 3 ? randomBetween(0, BUBBLE_COLORS.length - 1) : -1))
}
function bubbleCluster(board, startRow, startCol, color) {
  const pending = [[startRow, startCol]]
  const found = new Set()
  while (pending.length) {
    const [row, col] = pending.pop()
    const key = `${row}:${col}`
    if (row < 0 || row >= board.length || col < 0 || col >= board[0].length || found.has(key) || board[row][col] !== color) continue
    found.add(key)
    pending.push([row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1])
  }
  return [...found].map((key) => key.split(':').map(Number))
}
function removeFloatingBubbles(board) {
  const attached = new Set()
  const pending = board[0].map((color, col) => color >= 0 ? [0, col] : null).filter(Boolean)
  while (pending.length) {
    const [row, col] = pending.pop()
    const key = `${row}:${col}`
    if (attached.has(key) || board[row][col] < 0) continue
    attached.add(key)
    pending.push([row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1])
  }
  return board.map((line, row) => line.map((color, col) => color >= 0 && !attached.has(`${row}:${col}`) ? -1 : color))
}
function BubbleShooterGame({ profile, callbacks }) {
  const gameId = 'bubble-shooter'
  const session = useSession(gameId, callbacks)
  const [board, setBoard] = useState(createBubbleBoard)
  const [bubble, setBubble] = useState(0)
  const [shots, setShots] = useState(0)
  const [score, setScore] = useState(0)
  const start = () => { setBoard(createBubbleBoard()); setBubble(randomBetween(0, BUBBLE_COLORS.length - 1)); setShots(0); setScore(0); session.start() }
  const shoot = (column) => {
    if (session.phase !== 'playing') return
    const row = board.map((line) => line[column]).lastIndexOf(-1)
    if (row < 0) { session.finish(score, false); return }
    const next = board.map((line) => [...line])
    next[row][column] = bubble
    const cluster = bubbleCluster(next, row, column, bubble)
    let points = 0
    if (cluster.length >= 3) {
      cluster.forEach(([r, c]) => { next[r][c] = -1 })
      points += cluster.length * 10
      const floating = removeFloatingBubbles(next)
      points += floating.flat().filter((color, index) => color < 0 && next.flat()[index] >= 0).length * 10
      setBoard(floating)
      if (floating.flat().every((color) => color < 0)) { const finalScore = score + points; setScore(finalScore); session.finish(finalScore, true); return }
    } else setBoard(next)
    const nextScore = score + points
    const nextShots = shots + 1
    setScore(nextScore); setShots(nextShots); setBubble(randomBetween(0, BUBBLE_COLORS.length - 1))
    if (nextShots >= 40 || next.every((line) => line.every((color) => color >= 0))) session.finish(nextScore, false)
  }
  return <Mode gameId={gameId} profile={profile} callbacks={callbacks} session={session} score={score} start={start}
    instructions="Klicke eine Spalte an, um die aktuelle Blase dort abzuschießen. Drei oder mehr verbundene Blasen derselben Farbe platzen; nicht mehr am oberen Rand befestigte Blasen fallen ebenfalls."
    controls="SPALTE ZUM ZIELEN UND SCHIESSEN ANKLICKEN">
    <div className="arcade-bubble-game"><div className="arcade-bubble-board">{board.map((row, rowIndex) => row.map((color, colIndex) => <button type="button" key={`${rowIndex}-${colIndex}`} className={color < 0 ? 'empty' : ''} style={color < 0 ? undefined : { '--bubble-color': BUBBLE_COLORS[color] }} onClick={() => shoot(colIndex)} aria-label={`Spalte ${colIndex + 1}, ${color < 0 ? 'leer' : 'Blase'}`} />))}</div><div className="arcade-bubble-shooter"><span style={{ '--bubble-color': BUBBLE_COLORS[bubble] }} /><small>AKTUELLE BLASE · {40 - shots} SCHÜSSE</small></div></div>
  </Mode>
}

function DoodleGame({ profile, callbacks }) {
  const gameId = 'doodle-jump'
  const session = useSession(gameId, callbacks)
  const gameRef = useRef(null)
  const inputRef = useRef(0)
  const [game, setGame] = useState({ x: 180, y: 380, offset: 0, score: 0, platforms: [] })
  const createRun = () => ({
    x: 180, y: 380, vy: -8, offset: 0, score: 0,
    platforms: [{ x: 150, y: 415, width: 70 }, { x: 35, y: 345, width: 65 }, { x: 235, y: 275, width: 65 }, { x: 85, y: 205, width: 70 }, { x: 260, y: 135, width: 65 }, { x: 120, y: 65, width: 70 }],
  })
  const start = () => { const run = createRun(); gameRef.current = run; setGame({ ...run }); inputRef.current = 0; session.start() }
  useEffect(() => {
    if (session.phase !== 'playing') return undefined
    const timer = window.setInterval(() => {
      const current = gameRef.current
      const previousBottom = current.y + 24
      current.x = (current.x + inputRef.current * 5 + 390) % 390
      current.vy += .28; current.y += current.vy
      if (current.vy > 0) {
        const platform = current.platforms.find((item) => previousBottom <= item.y && current.y + 24 >= item.y && current.x + 26 > item.x && current.x < item.x + item.width)
        if (platform) current.vy = -8
      }
      if (current.y - current.offset < 180) current.offset = current.y - 180
      current.score = Math.max(current.score, Math.floor((380 - current.y) / 5))
      while (Math.min(...current.platforms.map((item) => item.y)) - current.offset > -80) {
        const top = Math.min(...current.platforms.map((item) => item.y))
        current.platforms.push({ x: randomBetween(4, 315), y: top - randomBetween(55, 76), width: 62 })
      }
      current.platforms = current.platforms.filter((item) => item.y - current.offset < 530)
      if (current.y - current.offset > 510) { session.finish(current.score, false); return }
      setGame({ ...current, platforms: [...current.platforms] })
    }, 24)
    return () => window.clearInterval(timer)
  }, [session.phase, session.finish])
  const keyDown = (event) => {
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') { inputRef.current = -1; event.preventDefault() }
    if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') { inputRef.current = 1; event.preventDefault() }
  }
  const keyUp = () => { inputRef.current = 0 }
  return <Mode gameId={gameId} profile={profile} callbacks={callbacks} session={session} score={game.score} start={start}
    instructions="Der Springer hüpft automatisch. Bewege ihn links und rechts und lande auf Plattformen, um aufzusteigen."
    controls="← → / A D BEWEGEN">
    <div className="arcade-doodle-field" onKeyDown={keyDown} onKeyUp={keyUp} onBlur={keyUp} tabIndex="0">
      {game.platforms.map((platform, index) => <i key={index} style={{ left: `${platform.x / 390 * 100}%`, top: `${(platform.y - game.offset) / 500 * 100}%`, width: `${platform.width / 390 * 100}%` }} />)}
      <span className="arcade-doodle-player" style={{ left: `${game.x / 390 * 100}%`, top: `${(game.y - game.offset) / 500 * 100}%` }}>✦</span>
    </div>
  </Mode>
}

function NeonRacerGame({ profile, callbacks }) {
  const gameId = 'neon-racer'
  const session = useSession(gameId, callbacks)
  const [lane, setLane] = useState(1)
  const [obstacles, setObstacles] = useState([])
  const [score, setScore] = useState(0)
  const stateRef = useRef({ lane: 1, obstacles: [], score: 0, ticks: 0 })
  const start = () => { stateRef.current = { lane: 1, obstacles: [], score: 0, ticks: 0 }; setLane(1); setObstacles([]); setScore(0); session.start() }
  const steer = (delta) => {
    const next = Math.max(0, Math.min(2, stateRef.current.lane + delta))
    stateRef.current.lane = next
    setLane(next)
  }
  useEffect(() => {
    if (session.phase !== 'playing') return undefined
    const timer = window.setInterval(() => {
      const current = stateRef.current
      current.ticks += 1
      current.obstacles = current.obstacles.map((item) => ({ ...item, y: item.y + 5 + Math.min(4, current.score / 20) }))
        .filter((item) => item.y < 530)
      if (current.ticks % 22 === 0) current.obstacles.push({ lane: randomBetween(0, 2), y: -30 })
      if (current.obstacles.some((item) => item.lane === current.lane && item.y > 390 && item.y < 455)) {
        session.finish(current.score, false)
        return
      }
      current.score += current.obstacles.filter((item) => item.y >= 470 && item.y < 480).length * 10
      setScore(current.score); setObstacles([...current.obstacles])
    }, 35)
    return () => window.clearInterval(timer)
  }, [session.phase, session.finish])
  return <Mode gameId={gameId} profile={profile} callbacks={callbacks} session={session} score={score} start={start}
    instructions="Steuere dein Fahrzeug zwischen drei Spuren und weiche den Hindernissen aus. Das Tempo steigt mit deiner Strecke."
    controls="← → WECHSELN ODER SPUR KLICKEN">
    <div className="arcade-racer-field" onKeyDown={(event) => { if (event.key === 'ArrowLeft') steer(-1); if (event.key === 'ArrowRight') steer(1) }} tabIndex="0">
      <div className="arcade-racer-lanes"><i /><i /></div>
      {obstacles.map((item, index) => <span key={index} className="arcade-racer-obstacle" style={{ left: `${18 + item.lane * 32}%`, top: `${item.y / 500 * 100}%` }} />)}
      <span className="arcade-racer-car" style={{ left: `${18 + lane * 32}%` }} />
      <div className="arcade-racer-steering"><button type="button" onClick={() => steer(-1)}>←</button><button type="button" onClick={() => steer(1)}>→</button></div>
    </div>
  </Mode>
}

function makeMaze(size = 15) {
  const cells = Array.from({ length: size }, () => Array(size).fill('#'))
  const visit = (row, col) => {
    cells[row][col] = '.'
    const directions = [[-2, 0], [2, 0], [0, -2], [0, 2]].sort(() => Math.random() - .5)
    for (const [dr, dc] of directions) {
      const r = row + dr; const c = col + dc
      if (r > 0 && r < size - 1 && c > 0 && c < size - 1 && cells[r][c] === '#') {
        cells[row + dr / 2][col + dc / 2] = '.'
        visit(r, c)
      }
    }
  }
  visit(1, 1)
  cells[size - 2][size - 2] = 'G'
  return cells
}
function MazeGame({ profile, callbacks }) {
  const gameId = 'maze-runner'
  const session = useSession(gameId, callbacks)
  const [maze, setMaze] = useState(() => makeMaze())
  const [position, setPosition] = useState({ row: 1, col: 1 })
  const [moves, setMoves] = useState(0)
  const start = () => { setMaze(makeMaze()); setPosition({ row: 1, col: 1 }); setMoves(0); session.start() }
  const move = (dr, dc) => {
    if (session.phase !== 'playing') return
    const row = position.row + dr; const col = position.col + dc
    if (maze[row]?.[col] === '#') return
    setPosition({ row, col }); setMoves((count) => count + 1)
    if (maze[row]?.[col] === 'G') session.finish(Math.max(100, 1000 - moves * 5), true)
  }
  const key = (event) => {
    const direction = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[event.key]
    if (direction) { event.preventDefault(); move(...direction) }
  }
  return <Mode gameId={gameId} profile={profile} callbacks={callbacks} session={session} score={Math.max(0, 1000 - moves * 5)} start={start}
    instructions="Finde den Ausgang am unteren rechten Rand des frisch erzeugten Labyrinths."
    controls="PFEILTASTEN ZUM BEWEGEN">
    <div className="arcade-maze-board" onKeyDown={key} tabIndex="0">{maze.flatMap((row, r) => row.map((cell, c) => {
      const cellClass = [cell === '#' && 'wall', cell === 'G' && 'exit', position.row === r && position.col === c && 'player'].filter(Boolean).join(' ')
      return <i key={r * 10 + c} className={cellClass}>{position.row === r && position.col === c ? '●' : cell === 'G' ? '◆' : ''}</i>
    }))}</div>
  </Mode>
}

const SUDOKU_PUZZLE = [
  '530070000', '600195000', '098000060', '800060003', '400803001',
  '700020006', '060000280', '000419005', '000080079',
].map((row) => row.split('').map(Number))
const SUDOKU_SOLUTION = [
  '534678912', '672195348', '198342567', '859761423', '426853791',
  '713924856', '961537284', '287419635', '345286179',
].map((row) => row.split('').map(Number))
function SudokuGame({ profile, callbacks }) {
  const gameId = 'sudoku'
  const session = useSession(gameId, callbacks)
  const [board, setBoard] = useState(SUDOKU_PUZZLE.map((row) => [...row]))
  const [selected, setSelected] = useState(0)
  const [mistakes, setMistakes] = useState([])
  const [moves, setMoves] = useState(0)
  const start = () => { setBoard(SUDOKU_PUZZLE.map((row) => [...row])); setSelected(0); setMistakes([]); setMoves(0); session.start() }
  const enter = (value) => {
    const row = Math.floor(selected / 9); const col = selected % 9
    if (SUDOKU_PUZZLE[row][col] !== 0 || session.phase !== 'playing') return
    if (value && board[row].some((digit, index) => index !== col && digit === value)) return
    if (value && board.some((line, index) => index !== row && line[col] === value)) return
    const boxRow = Math.floor(row / 3) * 3; const boxCol = Math.floor(col / 3) * 3
    if (value && board.some((line, r) => r >= boxRow && r < boxRow + 3 && line.some((digit, c) => c >= boxCol && c < boxCol + 3 && !(r === row && c === col) && digit === value))) return
    const next = board.map((line) => [...line]); next[row][col] = value
    setBoard(next); setMoves((count) => count + 1)
    const incorrect = value !== 0 && next[row][col] !== SUDOKU_SOLUTION[row][col]
    setMistakes((current) => incorrect ? [...current, selected] : current.filter((index) => index !== selected))
    if (next.every((line, r) => line.every((digit, c) => digit === SUDOKU_SOLUTION[r][c]))) session.finish(Math.max(100, 1000 - moves * 5), true)
  }
  return <Mode gameId={gameId} profile={profile} callbacks={callbacks} session={session} score={Math.max(0, 1000 - moves * 5)} start={start}
    instructions="Fülle die freien Felder. Jede Ziffer darf in Zeile, Spalte und 3×3-Block nur einmal vorkommen."
    controls="FELD WÄHLEN · ZIFFER UNTEN EINGEBEN">
    <div className="arcade-sudoku-wrap"><div className="arcade-sudoku-grid">{board.flatMap((row, r) => row.map((value, c) => { const index = r * 9 + c; const cellClass = [selected === index && 'selected', mistakes.includes(index) && 'mistake', Math.floor(r / 3) % 2 === Math.floor(c / 3) % 2 && 'block-a'].filter(Boolean).join(' '); return <button type="button" key={index} disabled={SUDOKU_PUZZLE[r][c] !== 0 || session.phase !== 'playing'} className={cellClass} onClick={() => setSelected(index)}>{value || ''}</button> }))}</div><div className="arcade-sudoku-numbers">{Array.from({ length: 9 }, (_, i) => <button type="button" key={i} onClick={() => enter(i + 1)}>{i + 1}</button>)}<button type="button" onClick={() => enter(0)}>⌫</button></div></div>
  </Mode>
}

const REVERSI_DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]
function reversiFlips(board, index, color) {
  if (board[index]) return []
  const row = Math.floor(index / 8); const col = index % 8
  const flips = []
  for (const [dr, dc] of REVERSI_DIRS) {
    const line = []
    let r = row + dr; let c = col + dc
    while (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r * 8 + c] === 3 - color) { line.push(r * 8 + c); r += dr; c += dc }
    if (line.length && r >= 0 && r < 8 && c >= 0 && c < 8 && board[r * 8 + c] === color) flips.push(...line)
  }
  return flips
}
function ReversiGame({ profile, callbacks }) {
  const gameId = 'reversi'
  const session = useSession(gameId, callbacks)
  const initial = () => { const board = Array(64).fill(0); board[27] = 2; board[28] = 1; board[35] = 1; board[36] = 2; return board }
  const [board, setBoard] = useState(initial)
  const [turn, setTurn] = useState(1)
  const [message, setMessage] = useState('')
  const start = () => { setBoard(initial()); setTurn(1); setMessage(''); session.start() }
  const legal = (state, color) => state.map((_, index) => index).filter((index) => reversiFlips(state, index, color).length)
  const finish = (state) => {
    const black = state.filter((value) => value === 1).length
    const white = state.filter((value) => value === 2).length
    const won = black > white
    setMessage((won ? 'Du gewinnst' : black === white ? 'Unentschieden' : 'Die KI gewinnt') + ' · ' + black + ' zu ' + white)
    session.finish(black * 10, won)
  }
  const place = (index) => {
    const flips = reversiFlips(board, index, 1)
    if (!flips.length || turn !== 1 || session.phase !== 'playing') return
    const next = [...board]; next[index] = 1; flips.forEach((cell) => { next[cell] = 1 })
    const nextPlayer = legal(next, 1)
    const nextAi = legal(next, 2)
    setBoard(next)
    if (!nextPlayer.length && !nextAi.length) { finish(next); return }
    setTurn(nextAi.length ? 2 : 1)
    if (!nextAi.length) setMessage('Die KI muss aussetzen.')
    else setMessage('')
  }
  useEffect(() => {
    if (turn !== 2 || session.phase !== 'playing') return undefined
    const timer = window.setTimeout(() => {
      const options = legal(board, 2)
      if (!options.length) {
        if (!legal(board, 1).length) finish(board)
        else { setTurn(1); setMessage('Die KI setzt aus.') }
        return
      }
      const selected = options.sort((a, b) => reversiFlips(board, b, 2).length - reversiFlips(board, a, 2).length)[0]
      const next = [...board]; next[selected] = 2; reversiFlips(board, selected, 2).forEach((cell) => { next[cell] = 2 })
      if (!legal(next, 1).length && !legal(next, 2).length) { setBoard(next); finish(next) }
      else { setBoard(next); setTurn(legal(next, 1).length ? 1 : 2) }
    }, 350)
    return () => window.clearTimeout(timer)
  }, [board, session.phase, turn])
  return <Mode gameId={gameId} profile={profile} callbacks={callbacks} session={session} score={board.filter((value) => value === 1).length * 10} start={start} result={message || undefined}
    instructions="Setze Schwarz. Ein gegnerischer Stein wird umgedreht, wenn deine Steine ihn in einer geraden Linie einschließen."
    controls="GÜLTIGES FELD ANKLICKEN · SCHWARZ GEGEN WEISS">
    <div className="arcade-reversi-board">{board.map((value, index) => <button type="button" key={index} disabled={session.phase !== 'playing' || turn !== 1 || Boolean(value) || !reversiFlips(board, index, 1).length} onClick={() => place(index)}>{value ? <i className={value === 1 ? 'disc black' : 'disc white'} /> : ''}</button>)}</div>
  </Mode>
}

function initialCheckers() {
  const board = Array(64).fill(0)
  for (let row = 0; row < 3; row += 1) for (let col = 0; col < 8; col += 1) if ((row + col) % 2 === 1) board[row * 8 + col] = 2
  for (let row = 5; row < 8; row += 1) for (let col = 0; col < 8; col += 1) if ((row + col) % 2 === 1) board[row * 8 + col] = 1
  return board
}
function checkersCaptureMoves(board, index, piece) {
  const row = Math.floor(index / 8); const col = index % 8
  const isPlayer = piece === 1 || piece === 3
  const king = piece === 3 || piece === 4
  const directions = king ? [-1, 1] : [isPlayer ? -1 : 1]
  const moves = []
  for (const dr of directions) for (const dc of [-1, 1]) {
    const r = row + dr; const c = col + dc
    const rr = row + dr * 2; const cc = col + dc * 2
    if (r < 0 || r >= 8 || c < 0 || c >= 8 || rr < 0 || rr >= 8 || cc < 0 || cc >= 8) continue
    const middle = board[r * 8 + c]
    const enemy = isPlayer ? middle === 2 || middle === 4 : middle === 1 || middle === 3
    if (enemy && !board[rr * 8 + cc]) moves.push({ from: index, to: rr * 8 + cc, capture: r * 8 + c })
  }
  return moves
}
function legalCheckersMoves(board, color) {
  const pieces = color === 1 ? [1, 3] : [2, 4]
  const captures = []
  const regular = []
  board.forEach((piece, index) => {
    if (!pieces.includes(piece)) return
    captures.push(...checkersCaptureMoves(board, index, piece))
    const row = Math.floor(index / 8); const col = index % 8
    const isPlayer = color === 1
    const dirs = piece === 3 || piece === 4 ? [-1, 1] : [isPlayer ? -1 : 1]
    for (const dr of dirs) for (const dc of [-1, 1]) {
      const r = row + dr; const c = col + dc
      if (r >= 0 && r < 8 && c >= 0 && c < 8 && !board[r * 8 + c]) regular.push({ from: index, to: r * 8 + c, capture: -1 })
    }
  })
  return captures.length ? captures : regular
}
function applyCheckersMove(board, move) {
  const next = [...board]
  const piece = next[move.from]
  next[move.from] = 0
  if (move.capture >= 0) next[move.capture] = 0
  const row = Math.floor(move.to / 8)
  next[move.to] = piece === 1 && row === 0 ? 3 : piece === 2 && row === 7 ? 4 : piece
  return next
}
function CheckersGame({ profile, callbacks }) {
  const gameId = 'checkers'
  const session = useSession(gameId, callbacks)
  const [board, setBoard] = useState(initialCheckers)
  const [selected, setSelected] = useState(-1)
  const [turn, setTurn] = useState(1)
  const [chain, setChain] = useState(false)
  const [message, setMessage] = useState('')
  const turnRef = useRef(0)
  const start = () => { turnRef.current += 1; setBoard(initialCheckers()); setSelected(-1); setTurn(1); setChain(false); setMessage(''); session.start() }
  const end = (state, playerWon) => {
    const count = state.filter((piece) => piece === 1 || piece === 3).length
    setMessage(playerWon ? 'Du hast gewonnen!' : 'Die Vexlor-KI gewinnt.')
    session.finish(playerWon ? 1000 + count : count, playerWon)
  }
  const finishIfNeeded = (state, currentTurn) => {
    const moves = legalCheckersMoves(state, currentTurn)
    if (moves.length) return false
    end(state, currentTurn === 2)
    return true
  }
  const play = (index) => {
    if (session.phase !== 'playing' || turn !== 1) return
    const options = legalCheckersMoves(board, 1)
    if (selected < 0 || board[selected] !== 1 && board[selected] !== 3) {
      if (board[index] === 1 || board[index] === 3) setSelected(index)
      return
    }
    const move = options.find((item) => item.from === selected && item.to === index)
    if (!move) {
      if (!chain && (board[index] === 1 || board[index] === 3)) setSelected(index)
      return
    }
    const next = applyCheckersMove(board, move)
    const followUp = move.capture >= 0 ? checkersCaptureMoves(next, move.to, next[move.to]) : []
    setBoard(next)
    if (followUp.length) { setSelected(move.to); setChain(true); return }
    setSelected(-1); setChain(false)
    if (!next.some((piece) => piece === 2 || piece === 4)) { end(next, true); return }
    if (finishIfNeeded(next, 2)) return
    setTurn(2)
    const token = turnRef.current
    window.setTimeout(() => {
      if (token !== turnRef.current) return
      let aiBoard = next
      let aiMoves = legalCheckersMoves(aiBoard, 2)
      let moveAi = aiMoves[randomBetween(0, aiMoves.length - 1)]
      aiBoard = applyCheckersMove(aiBoard, moveAi)
      while (moveAi.capture >= 0) {
        const follow = checkersCaptureMoves(aiBoard, moveAi.to, aiBoard[moveAi.to])
        if (!follow.length) break
        moveAi = follow[randomBetween(0, follow.length - 1)]
        aiBoard = applyCheckersMove(aiBoard, moveAi)
      }
      setBoard(aiBoard)
      if (!aiBoard.some((piece) => piece === 1 || piece === 3)) { end(aiBoard, false); return }
      if (!finishIfNeeded(aiBoard, 1)) setTurn(1)
    }, 280)
  }
  return <Mode gameId={gameId} profile={profile} callbacks={callbacks} session={session} score={board.filter((piece) => piece === 1 || piece === 3).length * 100} start={start} result={message || undefined}
    instructions="Bewege deine Steine diagonal. Schlagen ist Pflicht; erreiche die gegenüberliegende Grundlinie, um eine Dame zu erhalten."
    controls="EIGENEN STEIN UND ZIELFELD ANKLICKEN · ROT GEGEN VIOLETT">
    <div className="arcade-checkers-board">{board.map((piece, index) => {
      const cellClass = [Math.floor(index / 8) % 2 === index % 2 ? 'light' : 'dark', selected === index && 'selected'].filter(Boolean).join(' ')
      const pieceClass = ['checker-piece', piece === 1 || piece === 3 ? 'player' : 'cpu', piece > 2 && 'king'].filter(Boolean).join(' ')
      return <button type="button" key={index} className={cellClass} disabled={session.phase !== 'playing' || turn !== 1} onClick={() => play(index)}>{piece ? <i className={pieceClass} /> : ''}</button>
    })}</div>
  </Mode>
}

const TETRIS_SHAPES = [
  [[1, 1, 1, 1]],
  [[1, 1], [1, 1]],
  [[0, 1, 0], [1, 1, 1]],
  [[1, 0, 0], [1, 1, 1]],
  [[0, 0, 1], [1, 1, 1]],
  [[1, 1, 0], [0, 1, 1]],
  [[0, 1, 1], [1, 1, 0]],
]
function createTetrisPiece() {
  return { shape: TETRIS_SHAPES[randomBetween(0, TETRIS_SHAPES.length - 1)], x: 3, y: 0, color: randomBetween(1, 6) }
}
function tetrisFits(grid, piece) {
  return piece.shape.every((row, y) => row.every((cell, x) => !cell || (piece.y + y < 20 && piece.x + x >= 0 && piece.x + x < 10 && piece.y + y >= 0 && !grid[piece.y + y][piece.x + x])))
}
function TetrisGame({ profile, callbacks }) {
  const gameId = 'tetris'
  const session = useSession(gameId, callbacks)
  const gridRef = useRef(Array.from({ length: 20 }, () => Array(10).fill(0)))
  const pieceRef = useRef(createTetrisPiece())
  const scoreRef = useRef(0)
  const [grid, setGrid] = useState(gridRef.current)
  const [piece, setPiece] = useState(pieceRef.current)
  const [score, setScore] = useState(0)
  const start = () => {
    gridRef.current = Array.from({ length: 20 }, () => Array(10).fill(0))
    pieceRef.current = createTetrisPiece(); scoreRef.current = 0
    setGrid(gridRef.current.map((row) => [...row])); setPiece({ ...pieceRef.current }); setScore(0); session.start()
  }
  const lockPiece = () => {
    const locked = gridRef.current.map((row) => [...row])
    pieceRef.current.shape.forEach((row, y) => row.forEach((cell, x) => { if (cell && pieceRef.current.y + y >= 0) locked[pieceRef.current.y + y][pieceRef.current.x + x] = pieceRef.current.color }))
    const kept = locked.filter((row) => row.some((cell) => !cell))
    const cleared = 20 - kept.length
    gridRef.current = [...Array.from({ length: cleared }, () => Array(10).fill(0)), ...kept]
    scoreRef.current += cleared * 100
    pieceRef.current = createTetrisPiece()
    if (!tetrisFits(gridRef.current, pieceRef.current)) { session.finish(scoreRef.current, false); return }
    setGrid(gridRef.current.map((row) => [...row])); setPiece({ ...pieceRef.current }); setScore(scoreRef.current)
  }
  const move = (dx, dy = 0, rotate = false) => {
    const current = pieceRef.current
    const nextShape = rotate ? current.shape[0].map((_, x) => current.shape.map((row) => row[x]).reverse()) : current.shape
    const next = { ...current, x: current.x + dx, y: current.y + dy, shape: nextShape }
    if (tetrisFits(gridRef.current, next)) { pieceRef.current = next; setPiece({ ...next }); return true }
    if (dy) lockPiece()
    return false
  }
  useEffect(() => {
    if (session.phase !== 'playing') return undefined
    const timer = window.setInterval(() => { move(0, 1) }, 520)
    return () => window.clearInterval(timer)
  }, [session.phase])
  const key = (event) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1) }
    if (event.key === 'ArrowRight') { event.preventDefault(); move(1) }
    if (event.key === 'ArrowDown') { event.preventDefault(); move(0, 1) }
    if (event.key === 'ArrowUp') { event.preventDefault(); move(0, 0, true) }
  }
  const display = grid.map((row) => [...row])
  piece.shape.forEach((row, y) => row.forEach((cell, x) => { if (cell && piece.y + y >= 0 && piece.y + y < 20 && piece.x + x >= 0 && piece.x + x < 10) display[piece.y + y][piece.x + x] = piece.color }))
  return <Mode gameId={gameId} profile={profile} callbacks={callbacks} session={session} score={score} start={start}
    instructions="Fülle Reihen ohne Lücken. Pfeile bewegen, ↑ dreht den Stein; vollständige Reihen verschwinden."
    controls="← → BEWEGEN · ↑ DREHEN · ↓ FALLEN">
    <div className="arcade-tetris-board" onKeyDown={key} tabIndex="0">{display.flatMap((row, y) => row.map((value, x) => <i key={y * 10 + x} className={value ? 'filled c' + value : ''} />))}</div>
  </Mode>
}

const chessRays = {
  r: [[-1, 0], [1, 0], [0, -1], [0, 1]],
  b: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
  q: [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]],
  n: [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]],
  k: [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]],
}

function initialChessBoard() {
  return [...'rnbqkbnr', ...Array(8).fill('p'), ...Array(32).fill(''), ...Array(8).fill('P'), ...'RNBQKBNR']
}

function chessPseudoMoves(board, index, side) {
  const piece = board[index]
  if (!piece || (side === 1) !== (piece === piece.toUpperCase())) return []
  const row = Math.floor(index / 8)
  const col = index % 8
  const type = piece.toLowerCase()
  if (type === 'p') {
    const step = side === 1 ? -1 : 1
    const moves = []
    const nextRow = row + step
    if (nextRow >= 0 && nextRow < 8 && !board[nextRow * 8 + col]) {
      moves.push(nextRow * 8 + col)
      const startRow = side === 1 ? 6 : 1
      const twoSteps = nextRow + step
      if (row === startRow && !board[twoSteps * 8 + col]) moves.push(twoSteps * 8 + col)
    }
    for (const dc of [-1, 1]) {
      const targetRow = row + step
      const targetCol = col + dc
      if (targetRow < 0 || targetRow > 7 || targetCol < 0 || targetCol > 7) continue
      const target = board[targetRow * 8 + targetCol]
      if (target && (side === 1) !== (target === target.toUpperCase())) moves.push(targetRow * 8 + targetCol)
    }
    return moves
  }
  const moves = []
  for (const [dr, dc] of chessRays[type]) {
    let targetRow = row + dr
    let targetCol = col + dc
    while (targetRow >= 0 && targetRow < 8 && targetCol >= 0 && targetCol < 8) {
      const targetIndex = targetRow * 8 + targetCol
      const target = board[targetIndex]
      if (!target) moves.push(targetIndex)
      else {
        if ((side === 1) !== (target === target.toUpperCase())) moves.push(targetIndex)
        break
      }
      if (type === 'n' || type === 'k') break
      targetRow += dr
      targetCol += dc
    }
  }
  return moves
}

function chessKingInCheck(board, side) {
  const kingIndex = board.indexOf(side === 1 ? 'K' : 'k')
  if (kingIndex < 0) return true
  return board.some((piece, index) => piece
    && ((side === 1) !== (piece === piece.toUpperCase()))
    && chessPseudoMoves(board, index, 3 - side).includes(kingIndex))
}

function chessLegalMoves(board, side) {
  const moves = []
  for (let from = 0; from < board.length; from += 1) {
    const piece = board[from]
    if (!piece || ((side === 1) !== (piece === piece.toUpperCase()))) continue
    for (const to of chessPseudoMoves(board, from, side)) {
      const next = [...board]
      next[to] = piece
      next[from] = ''
      if (piece === 'P' && to < 8) next[to] = 'Q'
      if (piece === 'p' && to >= 56) next[to] = 'q'
      if (!chessKingInCheck(next, side)) moves.push({ from, to, piece, captured: board[to] })
    }
  }
  return moves
}

function applyChessMove(board, move) {
  const next = [...board]
  next[move.to] = move.piece
  next[move.from] = ''
  if (move.piece === 'P' && move.to < 8) next[move.to] = 'Q'
  if (move.piece === 'p' && move.to >= 56) next[move.to] = 'q'
  return next
}

function ChessGame({ profile, callbacks }) {
  const gameId = 'chess'
  const session = useSession(gameId, callbacks)
  const [board, setBoard] = useState(initialChessBoard)
  const [selected, setSelected] = useState(-1)
  const [turn, setTurn] = useState(1)
  const [movesPlayed, setMovesPlayed] = useState(0)
  const [message, setMessage] = useState('')
  const [thinking, setThinking] = useState(false)
  const start = () => {
    setBoard(initialChessBoard())
    setSelected(-1)
    setTurn(1)
    setMovesPlayed(0)
    setMessage('')
    setThinking(false)
    session.start()
  }
  const endIfNoMoves = (next, side) => {
    if (chessLegalMoves(next, side).length) return false
    const checked = chessKingInCheck(next, side)
    const won = checked && side === 2
    const result = checked ? (won ? 'Schachmatt – du gewinnst!' : 'Schachmatt – die KI gewinnt.') : 'Patt – unentschieden.'
    setMessage(result)
    session.finish(won ? Math.max(100, 1000 - movesPlayed * 5) : 0, won)
    return true
  }
  useEffect(() => {
    if (session.phase !== 'playing' || turn !== 2) return undefined
    setThinking(true)
    const timer = window.setTimeout(() => {
      const values = { p: 10, n: 30, b: 30, r: 50, q: 90, k: 1000 }
      const moves = chessLegalMoves(board, 2).sort((a, b) => {
        const scoreA = a.captured ? values[a.captured.toLowerCase()] : 0
        const scoreB = b.captured ? values[b.captured.toLowerCase()] : 0
        return scoreB - scoreA
      })
      if (!moves.length) {
        endIfNoMoves(board, 2)
        setThinking(false)
        return
      }
      const best = moves.filter((move) => (move.captured ? values[move.captured.toLowerCase()] : 0)
        === (moves[0].captured ? values[moves[0].captured.toLowerCase()] : 0))
      const next = applyChessMove(board, best[randomBetween(0, best.length - 1)])
      setBoard(next)
      setMovesPlayed((count) => count + 1)
      setThinking(false)
      setTurn(1)
      endIfNoMoves(next, 1)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [board, session.phase, turn])
  const movesFromSelected = selected < 0 ? [] : chessLegalMoves(board, 1).filter((move) => move.from === selected).map((move) => move.to)
  const selectCell = (index) => {
    if (session.phase !== 'playing' || turn !== 1 || thinking) return
    if (selected < 0) {
      if (board[index] && board[index] === board[index].toUpperCase()) setSelected(index)
      return
    }
    const move = chessLegalMoves(board, 1).find((candidate) => candidate.from === selected && candidate.to === index)
    if (!move) {
      setSelected(board[index] && board[index] === board[index].toUpperCase() ? index : -1)
      return
    }
    const next = applyChessMove(board, move)
    setBoard(next)
    setSelected(-1)
    setMovesPlayed((count) => count + 1)
    if (!endIfNoMoves(next, 2)) setTurn(2)
  }
  const glyphs = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙', k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
  return <Mode gameId={gameId} profile={profile} callbacks={callbacks} session={session} score={Math.max(0, 1000 - movesPlayed * 5)} start={start} result={message || undefined}
    instructions="Wähle eine weiße Figur und ein gültiges Zielfeld. Die KI spielt Schwarz; Bauern werden am Brettrand automatisch zu Damen."
    controls="FIGUR WÄHLEN · ZUGFELD WÄHLEN · ESC PAUSE">
    <div className="arcade-chess-wrap">
      <div className="arcade-chess-turn">{thinking ? 'Vexlor-KI überlegt …' : turn === 1 ? 'Dein Zug · Weiß' : 'Vexlor-KI · Schwarz'}</div>
      <div className="arcade-chess-board">{board.map((piece, index) => {
        const className = [Math.floor(index / 8) % 2 === index % 2 ? 'light' : 'dark', selected === index && 'selected', movesFromSelected.includes(index) && 'legal'].filter(Boolean).join(' ')
        return <button type="button" key={index} className={className} disabled={session.phase !== 'playing' || turn !== 1} onClick={() => selectCell(index)} aria-label={`Feld ${index + 1}`}>{piece ? glyphs[piece] : ''}</button>
      })}</div>
    </div>
  </Mode>
}

function createBattleshipFleet() {
  const board = Array(64).fill(0)
  for (const size of [4, 3, 3]) {
    let placed = false
    while (!placed) {
      const row = randomBetween(0, 7)
      const col = randomBetween(0, 7)
      const horizontal = Math.random() < 0.5
      const cells = Array.from({ length: size }, (_, step) => horizontal
        ? row * 8 + col + step
        : (row + step) * 8 + col)
      if (cells.some((cell) => cell >= 64 || (horizontal && Math.floor(cell / 8) !== row) || board[cell])) continue
      cells.forEach((cell) => { board[cell] = 1 })
      placed = true
    }
  }
  return board
}

function BattleshipGame({ profile, callbacks }) {
  const gameId = 'battleship'
  const session = useSession(gameId, callbacks)
  const [enemyShips, setEnemyShips] = useState(createBattleshipFleet)
  const [playerShips, setPlayerShips] = useState(createBattleshipFleet)
  const [enemyShots, setEnemyShots] = useState(Array(64).fill(-1))
  const [playerShots, setPlayerShots] = useState(Array(64).fill(-1))
  const [shots, setShots] = useState(0)
  const [turn, setTurn] = useState('player')
  const [thinking, setThinking] = useState(false)
  const [message, setMessage] = useState('')
  const start = () => {
    setEnemyShips(createBattleshipFleet())
    setPlayerShips(createBattleshipFleet())
    setEnemyShots(Array(64).fill(-1))
    setPlayerShots(Array(64).fill(-1))
    setShots(0)
    setTurn('player')
    setThinking(false)
    setMessage('')
    session.start()
  }
  const finish = (won, finalShots = shots) => {
    const result = won ? 'Sieg – die gegnerische Flotte ist versenkt!' : 'Niederlage – deine Flotte wurde versenkt.'
    setMessage(result)
    session.finish(won ? Math.max(100, 1000 - finalShots * 10) : finalShots * 10, won)
  }
  useEffect(() => {
    if (session.phase !== 'playing' || turn !== 'ai') return undefined
    setThinking(true)
    const timer = window.setTimeout(() => {
      const available = enemyShots.map((value, index) => value < 0 ? index : -1).filter((index) => index >= 0)
      if (!available.length) { setTurn('player'); setThinking(false); return }
      const target = available[randomBetween(0, available.length - 1)]
      const hit = playerShips[target] === 1
      const next = [...enemyShots]
      next[target] = hit ? 1 : 0
      setEnemyShots(next)
      setTurn('player')
      setThinking(false)
      if (hit && next.filter((value, index) => value === 1 && playerShips[index] === 1).length >= 10) finish(false)
    }, 320)
    return () => window.clearTimeout(timer)
  }, [enemyShots, playerShips, session.phase, turn])
  const fire = (index) => {
    if (session.phase !== 'playing' || turn !== 'player' || playerShots[index] >= 0 || thinking) return
    const hit = enemyShips[index] === 1
    const next = [...playerShots]
    next[index] = hit ? 1 : 0
    setPlayerShots(next)
    const nextShots = shots + 1
    setShots(nextShots)
    if (hit && next.filter((value, cell) => value === 1 && enemyShips[cell] === 1).length >= 10) {
      finish(true, nextShots)
      return
    }
    setTurn('ai')
  }
  return <Mode gameId={gameId} profile={profile} callbacks={callbacks} session={session} score={shots} start={start} result={message || undefined}
    instructions="Flotte: ein Schiff mit vier und zwei Schiffe mit je drei Feldern. Feuere auf das gegnerische Raster; danach schießt die KI auf dein Feld."
    controls="GEGNERISCHES FELD ANKLICKEN · ROT = TREFFER · GRAU = WASSER">
    <div className="arcade-battleship-wrap">
      <div className="arcade-chess-turn">{thinking ? 'Die KI zielt …' : turn === 'player' ? 'Du bist am Zug' : 'Die KI schießt'}</div>
      <div className="arcade-battleship-fleets">
        <section><h3>Deine Flotte</h3><div className="arcade-battleship-grid">{playerShips.map((ship, index) => <span key={index} className={[ship && 'ship', enemyShots[index] === 1 && 'hit', enemyShots[index] === 0 && 'miss'].filter(Boolean).join(' ')} />)}</div></section>
        <section><h3>Gegnerische Flotte</h3><div className="arcade-battleship-grid">{enemyShips.map((_ship, index) => <button key={index} type="button" disabled={session.phase !== 'playing' || turn !== 'player' || playerShots[index] >= 0} className={playerShots[index] === 1 ? 'hit' : playerShots[index] === 0 ? 'miss' : ''} onClick={() => fire(index)} aria-label={`Zielfeld ${index + 1}`} />)}</div></section>
      </div>
    </div>
  </Mode>
}

export function ArcadeMoreGame({ gameId, profile, onBack, onStartRound, onRecordTime, onFinishRound }) {
  const callbacks = { onBack, onStartRound, onRecordTime, onFinishRound }
  if (gameId === 'whack-a-mole') return <WhackGame profile={profile} callbacks={callbacks} />
  if (gameId === 'reaction-time') return <ReactionGame profile={profile} callbacks={callbacks} />
  if (gameId === 'aim-trainer') return <AimGame profile={profile} callbacks={callbacks} />
  if (gameId === 'stack-tower') return <StackGame profile={profile} callbacks={callbacks} />
  if (gameId === 'word-scramble') return <WordScrambleGame profile={profile} callbacks={callbacks} />
  if (gameId === 'word-guess') return <WordGuessGame profile={profile} callbacks={callbacks} />
  if (gameId === 'lights-out') return <LightsOutGame profile={profile} callbacks={callbacks} />
  if (gameId === 'sokoban') return <SokobanGame profile={profile} callbacks={callbacks} />
  if (gameId === 'tower-of-hanoi') return <HanoiGame profile={profile} callbacks={callbacks} />
  if (gameId === 'number-slide') return <NumberSlideGame profile={profile} callbacks={callbacks} />
  if (gameId === 'connect-four') return <ConnectFourGame profile={profile} callbacks={callbacks} />
  if (gameId === 'chess') return <ChessGame profile={profile} callbacks={callbacks} />
  if (gameId === 'battleship') return <BattleshipGame profile={profile} callbacks={callbacks} />
  if (gameId === 'mastermind') return <MastermindGame profile={profile} callbacks={callbacks} />
  if (gameId === 'quiz-challenge' || gameId === 'geography-quiz' || gameId === 'flag-quiz') return <QuizGame gameId={gameId} profile={profile} callbacks={callbacks} />
  if (gameId === 'quick-math') return <QuickMathGame profile={profile} callbacks={callbacks} />
  if (gameId === 'typing-speed') return <TypingGame profile={profile} callbacks={callbacks} />
  if (gameId === 'color-match') return <ColorMatchGame profile={profile} callbacks={callbacks} />
  if (gameId === 'simon-says') return <SimonGame profile={profile} callbacks={callbacks} />
  if (gameId === 'rock-paper-scissors') return <RpsGame profile={profile} callbacks={callbacks} />
  if (gameId === 'pong') return <PongGame profile={profile} callbacks={callbacks} />
  if (gameId === 'breakout') return <BreakoutGame profile={profile} callbacks={callbacks} />
  if (gameId === 'flappy') return <FlappyGame profile={profile} callbacks={callbacks} />
  if (gameId === 'bubble-shooter') return <BubbleShooterGame profile={profile} callbacks={callbacks} />
  if (gameId === 'doodle-jump') return <DoodleGame profile={profile} callbacks={callbacks} />
  if (gameId === 'neon-racer') return <NeonRacerGame profile={profile} callbacks={callbacks} />
  if (gameId === 'maze-runner') return <MazeGame profile={profile} callbacks={callbacks} />
  if (gameId === 'sudoku') return <SudokuGame profile={profile} callbacks={callbacks} />
  if (gameId === 'reversi') return <ReversiGame profile={profile} callbacks={callbacks} />
  if (gameId === 'checkers') return <CheckersGame profile={profile} callbacks={callbacks} />
  if (gameId === 'tetris') return <TetrisGame profile={profile} callbacks={callbacks} />
  return null
}
