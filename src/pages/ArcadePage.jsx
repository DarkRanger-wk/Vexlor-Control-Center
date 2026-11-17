import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { advanceGame, createGameState, GAME_HEIGHT, GAME_WIDTH } from '../services/arcade-engine.mjs'
import {
  ARCADE_ACHIEVEMENTS,
  addArcadePlayTime,
  beginArcadeRound,
  completeArcadeRound,
  createArcadeProfile,
  validateArcadeProfile,
} from '../services/arcade-profile.mjs'
import { ClickerGame, PuzzleGame, RunnerGame } from './ArcadeMiniGames'
import '../styles/arcade.css'

const gameCatalog = [
  { id: 'space-shooter', title: 'Vexlor Space Shooter', description: 'Weiche Gegnerwellen aus, sammle Verbesserungen und verteidige deinen Punkterekord.', status: 'PLAYABLE', color: 'blue' },
  { id: 'runner', title: 'Vexlor Runner', description: 'Springe und rutsche durch einen immer schnelleren Neon-Parcours.', status: 'PLAYABLE', color: 'cyan' },
  { id: 'clicker', title: 'Vexlor Clicker', description: 'Sammle Energie, kaufe Verbesserungen und automatisiere deine Produktion.', status: 'PLAYABLE', color: 'violet' },
  { id: 'puzzle', title: 'Vexlor Puzzle', description: 'Kombiniere Zahlenkacheln und knacke das 2048er-Logikrätsel.', status: 'PLAYABLE', color: 'green' },
]

const keyMap = {
  ArrowUp: 'up',
  w: 'up',
  ArrowDown: 'down',
  s: 'down',
  ArrowLeft: 'left',
  a: 'left',
  ArrowRight: 'right',
  d: 'right',
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  if (hours > 0) return `${hours} Std. ${minutes % 60} Min.`
  return `${minutes} Min.`
}

function formatClock(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0')
  const remainder = Math.floor(seconds % 60).toString().padStart(2, '0')
  return `${minutes}:${remainder}`
}

function errorMessage(error, fallback) {
  return error instanceof Error ? error.message : fallback
}

export default function ArcadePage() {
  const [profile, setProfile] = useState(createArcadeProfile)
  const [view, setView] = useState('hub')
  const [profileReady, setProfileReady] = useState(false)
  const [storageError, setStorageError] = useState('')
  const [volume, setVolume] = useState(0.35)
  const profileRef = useRef(profile)
  const mountedRef = useRef(true)
  const writeQueueRef = useRef(Promise.resolve())
  const writeRevisionRef = useRef(0)

  useEffect(() => {
    let active = true
    window.vcc.getArcadeProfile()
      .then((savedProfile) => {
        const validProfile = validateArcadeProfile(savedProfile)
        if (!active) return
        profileRef.current = validProfile
        setProfile(validProfile)
        setVolume(validProfile.soundVolume)
        setStorageError('')
        setProfileReady(true)
      })
      .catch((error) => {
        if (!active) return
        setStorageError(errorMessage(error, 'Arcade-Daten konnten nicht geladen werden.'))
        setProfileReady(true)
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const persistProfile = useCallback((candidate) => {
    const validProfile = validateArcadeProfile(candidate)
    const revision = ++writeRevisionRef.current
    profileRef.current = validProfile
    setProfile(validProfile)
    setStorageError('')

    const write = writeQueueRef.current
      .catch(() => undefined)
      .then(() => window.vcc.saveArcadeProfile(validProfile))
    writeQueueRef.current = write
    write.then((savedProfile) => {
      if (!mountedRef.current || revision !== writeRevisionRef.current) return
      const validated = validateArcadeProfile(savedProfile)
      profileRef.current = validated
      setProfile(validated)
      setVolume(validated.soundVolume)
    }, (error) => {
      if (!mountedRef.current || revision !== writeRevisionRef.current) return
      console.error('Arcade-Profil konnte nicht gespeichert werden:', error)
      setStorageError(errorMessage(error, 'Arcade-Daten konnten nicht gespeichert werden.'))
    })
  }, [])

  const startRound = useCallback((gameId = 'space-shooter') => {
    persistProfile(beginArcadeRound(profileRef.current, gameId))
  }, [persistProfile])

  const recordTime = useCallback((seconds) => {
    if (seconds < 1) return
    persistProfile(addArcadePlayTime(profileRef.current, seconds))
  }, [persistProfile])

  const finishRound = useCallback((score, unsavedSeconds, gameId = 'space-shooter') => {
    persistProfile(completeArcadeRound(profileRef.current, score, unsavedSeconds, gameId))
  }, [persistProfile])

  const updateProfile = useCallback((update) => {
    const current = profileRef.current
    const candidate = typeof update === 'function' ? update(current) : { ...current, ...update }
    persistProfile(candidate)
  }, [persistProfile])

  const saveVolume = useCallback((nextVolume) => {
    const current = profileRef.current
    persistProfile({ ...current, soundVolume: nextVolume })
  }, [persistProfile])

  const resetProfile = () => {
    if (!window.confirm('Arcade-Rekorde, Spielzeit und Erfolge auf diesem PC zurücksetzen?')) return
    persistProfile(createArcadeProfile())
    setVolume(0.35)
  }

  const miniGameProps = {
    profile,
    onBack: () => setView('hub'),
    onStartRound: startRound,
    onRecordTime: recordTime,
    onFinishRound: finishRound,
    onUpdate: updateProfile,
  }

  if (view === 'space-shooter') {
    return <SpaceShooter
      volume={volume}
      onBack={() => setView('hub')}
      onStartRound={startRound}
      onRecordTime={recordTime}
      onFinishRound={finishRound}
      onVolumeChange={(nextVolume) => setVolume(nextVolume)}
      onVolumeSave={() => saveVolume(volume)}
    />
  }
  if (view === 'runner') return <RunnerGame {...miniGameProps} />
  if (view === 'clicker') return <ClickerGame {...miniGameProps} />
  if (view === 'puzzle') return <PuzzleGame {...miniGameProps} />

  const unlocked = new Set(profile.achievements)
  const recentGames = profile.recentGames.map((id) => gameCatalog.find((game) => game.id === id)).filter(Boolean)

  return <section className="arcade-page">
    <header className="arcade-welcome">
      <div>
        <div className="eyebrow"><span className="eyebrow-line" /> VEXLOR ARCADE</div>
        <h1>Dein nächstes <span>Level.</span></h1>
        <p className="welcome-subtitle">Kurze Pause, große Rekorde. Deine Spiele und Erfolge bleiben lokal auf diesem PC.</p>
      </div>
      <div className="arcade-online-badge"><span /> OHNE INTERNET SPIELBAR</div>
    </header>

    {storageError && <div className="arcade-storage-error" role="alert">
      <span>{storageError}</span>
      <button type="button" className="arcade-link-button" onClick={resetProfile}>Lokales Profil zurücksetzen</button>
    </div>}
    {!profileReady && <p className="arcade-loading" role="status">Lokales Arcade-Profil wird geladen …</p>}

    <section className="arcade-stats" aria-label="Deine Arcade-Statistik">
      <StatCard label="PERSÖNLICHER REKORD" value={profile.highScore.toLocaleString('de-DE')} detail="Punkte · Space Shooter" icon="target" color="blue" />
      <StatCard label="GESPIELTE ZEIT" value={formatDuration(profile.totalPlayTimeSeconds)} detail={`${profile.roundsPlayed} ${profile.roundsPlayed === 1 ? 'Runde' : 'Runden'} insgesamt`} icon="clock" color="cyan" />
      <StatCard label="ERFOLGE" value={`${profile.achievements.length} / ${ARCADE_ACHIEVEMENTS.length}`} detail="automatisch freigeschaltet" icon="crown" color="violet" />
    </section>

    <section className="arcade-section">
      <div className="arcade-section-heading">
        <div><div className="section-kicker">DEINE SPIELE</div><h2>Arcade-Auswahl</h2></div>
        <span className="arcade-local-tag"><Icon name="spark" /> 100 % LOKAL</span>
      </div>
      <div className="arcade-game-grid">
        {gameCatalog.map((game) => <GameCard
          key={game.id}
          game={game}
          record={getGameRecord(game.id, profile)}
          onPlay={profileReady ? () => setView(game.id) : undefined}
        />)}
      </div>
    </section>

    <div className="arcade-lower-grid">
      <section className="arcade-panel">
        <div className="arcade-section-heading compact">
          <div><div className="section-kicker">WEITERGEHT'S</div><h2>Zuletzt gespielt</h2></div>
          <span className="arcade-count">{recentGames.length}</span>
        </div>
        {recentGames.length
          ? <div className="arcade-recent-list">{recentGames.slice(0, 3).map((game) => <div className="arcade-recent-item" key={game.id}>
            <span className={`arcade-mini-icon ${game.color}`}><Icon name="arcade" /></span>
            <span><strong>{game.title}</strong><small>{getRecentDetail(game.id, profile)}</small></span>
            <button type="button" aria-label={`${game.title} öffnen`} onClick={() => setView(game.id)}><Icon name="arrow" /></button>
          </div>)}</div>
          : <div className="arcade-empty-recent"><span className="arcade-empty-symbol">✦</span><strong>Dein erstes Spiel wartet.</strong><p>Starte ein Arcade-Spiel und es erscheint hier.</p></div>}
      </section>

      <section className="arcade-panel achievements-panel">
        <div className="arcade-section-heading compact">
          <div><div className="section-kicker">DEINE MEILENSTEINE</div><h2>Erfolge</h2></div>
          <span className="arcade-count">{profile.achievements.length}/{ARCADE_ACHIEVEMENTS.length}</span>
        </div>
        <div className="arcade-achievement-list">
          {ARCADE_ACHIEVEMENTS.map((achievement) => <AchievementCard
            key={achievement.id}
            achievement={achievement}
            unlocked={unlocked.has(achievement.id)}
            profile={profile}
          />)}
        </div>
      </section>
    </div>
  </section>
}

function StatCard({ label, value, detail, icon, color }) {
  return <article className={`arcade-stat-card ${color}`}>
    <div className="arcade-stat-head"><span className="arcade-stat-icon"><Icon name={icon} /></span><span>{label}</span><Icon className="arcade-stat-mark" name="spark" /></div>
    <strong>{value}</strong><small>{detail}</small>
  </article>
}

function GameCard({ game, record, onPlay }) {
  const playable = game.status === 'PLAYABLE'
  const readyToPlay = playable && typeof onPlay === 'function'
  return <article className={`arcade-game-card ${game.color}${playable ? ' playable' : ' upcoming'}`}>
    <div className="arcade-cover">
      <ArcadeArtwork gameId={game.id} />
      <span className={`arcade-status${playable ? ' available' : ''}`}>{playable ? 'JETZT SPIELBAR' : game.status}</span>
      {playable && <span className="arcade-cover-score"><Icon name="performance" /> {record.label} {record.value}</span>}
    </div>
    <div className="arcade-card-copy">
      <div className="arcade-card-title"><h3>{game.title}</h3>{playable && <span className="arcade-new-badge">SPIELBAR</span>}</div>
      <p>{game.description}</p>
      <button type="button" className={playable ? 'primary-button arcade-play-button' : 'arcade-upcoming-button'} onClick={readyToPlay ? onPlay : undefined} disabled={!readyToPlay}>
        {playable ? readyToPlay ? <>Spiel starten <Icon name="arrow" /></> : 'Profil wird geladen …' : <>Demnächst verfügbar <span>·</span></>}
      </button>
    </div>
  </article>
}

function getGameRecord(gameId, profile) {
  if (gameId === 'space-shooter') return { label: 'REKORD', value: profile.highScore.toLocaleString('de-DE') }
  if (gameId === 'runner') return { label: 'REKORD', value: profile.runnerBestScore.toLocaleString('de-DE') }
  if (gameId === 'clicker') return { label: 'ENERGIE', value: profile.clicker.energy.toLocaleString('de-DE') }
  return { label: 'REKORD', value: profile.puzzle.bestTile.toLocaleString('de-DE') }
}

function getRecentDetail(gameId, profile) {
  if (gameId === 'space-shooter' && profile.lastScore !== null) return `Letzte Runde · ${profile.lastScore.toLocaleString('de-DE')} Punkte`
  if (gameId === 'runner' && profile.runnerRuns > 0) return `Bestweite · ${profile.runnerBestScore.toLocaleString('de-DE')} Punkte`
  if (gameId === 'clicker') return `${profile.clicker.energy.toLocaleString('de-DE')} Energie · ${profile.clicker.generators}/s`
  if (gameId === 'puzzle') return `Bester Stein · ${profile.puzzle.bestTile.toLocaleString('de-DE')}`
  return 'Zuletzt gespielt'
}

function ArcadeArtwork({ gameId }) {
  return <svg className="arcade-artwork" viewBox="0 0 640 250" role="img" aria-label={`${gameCatalog.find((game) => game.id === gameId)?.title} Vorschau`}>
    <defs>
      <linearGradient id={`arcade-bg-${gameId}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={gameId === 'runner' ? '#082d38' : gameId === 'clicker' ? '#25173b' : gameId === 'puzzle' ? '#0d3029' : '#0b1d3d'} />
        <stop offset="1" stopColor="#08101d" />
      </linearGradient>
      <radialGradient id={`arcade-glow-${gameId}`}>
        <stop offset="0" stopColor={gameId === 'runner' ? '#38d8e6' : gameId === 'clicker' ? '#9a69ff' : gameId === 'puzzle' ? '#41dba0' : '#438dff'} stopOpacity=".55" />
        <stop offset="1" stopColor="#10223d" stopOpacity="0" />
      </radialGradient>
    </defs>
    <rect width="640" height="250" fill={`url(#arcade-bg-${gameId})`} />
    <ellipse cx="320" cy="128" rx="240" ry="125" fill={`url(#arcade-glow-${gameId})`} />
    <g fill="#cfe9ff" opacity=".8">
      <circle cx="92" cy="56" r="1.5" /><circle cx="152" cy="186" r="1" /><circle cx="227" cy="39" r="1.2" />
      <circle cx="501" cy="62" r="1.3" /><circle cx="547" cy="170" r="1.6" /><circle cx="413" cy="209" r="1" />
      <circle cx="363" cy="31" r="1" /><circle cx="46" cy="137" r="1" /><circle cx="595" cy="109" r="1" />
    </g>
    {gameId === 'space-shooter' && <g transform="translate(320 126)" filter="drop-shadow(0 0 12px #42caff)">
      <path d="M0-57 18 5 0-5-18 5Z" fill="#d7f6ff" stroke="#52caff" strokeWidth="3" />
      <path d="m-17 8-20 27 34-13m20-14 20 27-34-13" fill="#448fff" opacity=".8" />
      <path d="M-5 5h10l-5 22z" fill="#36e2ed" />
      <circle cx="0" cy="-7" r="3" fill="#fff" />
    </g>}
    {gameId === 'runner' && <g transform="translate(320 131)" fill="none" stroke="#39d9e8" strokeWidth="4">
      <path d="M-200 54h400M-170 24h340M-130-6h260M-75-36h150" opacity=".45" />
      <path d="m-45 44 14-50 24 16 15-35 22 69m18 0 17-28 15 28" stroke="#9af8ff" />
      <circle cx="0" cy="-57" r="17" fill="#39d9e8" fillOpacity=".2" />
    </g>}
    {gameId === 'clicker' && <g transform="translate(320 124)" filter="drop-shadow(0 0 15px #9a69ff)">
      <circle r="63" fill="#8d68ff" fillOpacity=".14" stroke="#aa8cff" strokeWidth="2" />
      <circle r="44" fill="#5c3cba" fillOpacity=".24" stroke="#d0bbff" strokeWidth="2" />
      <path d="m0-31 9 23 25 2-19 16 6 25L0 21l-21 14 6-25-19-16 25-2z" fill="#d6c6ff" />
    </g>}
    {gameId === 'puzzle' && <g transform="translate(320 124)" fill="none" stroke="#45e7aa" strokeWidth="4">
      <path d="M-78-63h58v58h-58zm78 0h58v58H0zm-78 78h58v58h-58zm78 0h58v58H0z" />
      <path d="M-49-34h18v18h-18zm78 0h18v18H29zm-78 78h18v18h-18zm78 0h18v18H29z" fill="#45e7aa" fillOpacity=".22" />
    </g>}
    <path d="M0 235h640" stroke="white" strokeOpacity=".07" />
  </svg>
}

function AchievementCard({ achievement, unlocked, profile }) {
  let progress = 0
  let progressLabel = 'Noch nicht begonnen'
  if (achievement.id === 'first-flight') {
    progress = profile.roundsPlayed ? 1 : 0
    progressLabel = profile.roundsPlayed ? 'Freigeschaltet' : 'Starte eine Runde'
  } else if (achievement.id.startsWith('score-')) {
    const target = Number(achievement.id.split('-')[1])
    progress = Math.min(1, profile.highScore / target)
    progressLabel = `${profile.highScore.toLocaleString('de-DE')} / ${target.toLocaleString('de-DE')} Punkte`
  } else {
    progress = Math.min(1, profile.totalPlayTimeSeconds / 3600)
    progressLabel = `${formatDuration(profile.totalPlayTimeSeconds)} / 60 Min.`
  }
  return <article className={`arcade-achievement${unlocked ? ' unlocked' : ''}`}>
    <span className="achievement-icon"><Icon name={achievement.icon} /></span>
    <div className="achievement-copy"><strong>{achievement.title}</strong><small>{achievement.description}</small>
      <div className="achievement-progress"><span style={{ width: `${Math.round(progress * 100)}%` }} /></div>
      <span className="achievement-progress-label">{progressLabel}</span>
    </div>
    <span className="achievement-state" aria-label={unlocked ? 'Freigeschaltet' : 'Gesperrt'}>{unlocked ? '✓' : '·'}</span>
  </article>
}

function SpaceShooter({ volume, onBack, onStartRound, onRecordTime, onFinishRound, onVolumeChange, onVolumeSave }) {
  const canvasRef = useRef(null)
  const gameRef = useRef(null)
  const inputRef = useRef({ up: false, down: false, left: false, right: false, shoot: false })
  const audioRef = useRef(null)
  const phaseRef = useRef('ready')
  const finishRef = useRef(() => {})
  const callbackRef = useRef({})
  const [phase, setPhase] = useState('ready')
  const [hud, setHud] = useState({ score: 0, elapsed: 0, health: 3, difficulty: 1 })

  callbackRef.current = { onStartRound, onRecordTime, onFinishRound }
  phaseRef.current = phase

  const clearInput = useCallback(() => {
    inputRef.current = { up: false, down: false, left: false, right: false, shoot: false }
  }, [])

  const playSound = useCallback((kind) => {
    if (volume <= 0) return
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      if (!AudioContextClass) return
      if (!audioRef.current) audioRef.current = new AudioContextClass()
      const audio = audioRef.current
      if (audio.state === 'suspended') void audio.resume().catch((error) => console.warn('Arcade-Audio konnte nicht gestartet werden:', error))
      const oscillator = audio.createOscillator()
      const gain = audio.createGain()
      const now = audio.currentTime
      const settings = {
        shoot: { start: 510, end: 220, duration: 0.07, type: 'sawtooth', volume: 0.08 },
        explosion: { start: 150, end: 45, duration: 0.16, type: 'triangle', volume: 0.15 },
        hit: { start: 190, end: 75, duration: 0.25, type: 'square', volume: 0.17 },
        powerup: { start: 390, end: 880, duration: 0.2, type: 'sine', volume: 0.13 },
        'shield-hit': { start: 600, end: 350, duration: 0.12, type: 'sine', volume: 0.12 },
      }[kind]
      oscillator.type = settings.type
      oscillator.frequency.setValueAtTime(settings.start, now)
      oscillator.frequency.exponentialRampToValueAtTime(settings.end, now + settings.duration)
      gain.gain.setValueAtTime(Math.max(0.0001, settings.volume * volume), now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + settings.duration)
      oscillator.connect(gain)
      gain.connect(audio.destination)
      oscillator.start(now)
      oscillator.stop(now + settings.duration)
    } catch (error) {
      console.warn('Arcade-Sound konnte nicht abgespielt werden:', error)
    }
  }, [volume])

  const persistRun = useCallback((game) => {
    if (!game || game.finished) return
    game.finished = true
    const totalSeconds = Math.floor(game.elapsed)
    const unsavedSeconds = Math.max(0, totalSeconds - game.savedSeconds)
    game.savedSeconds = totalSeconds
    game.status = 'ended'
    callbackRef.current.onFinishRound(game.score, unsavedSeconds)
  }, [])
  finishRef.current = persistRun

  const startRun = useCallback(() => {
    const context = canvasRef.current?.getContext('2d')
    if (!context) return
    gameRef.current = createGameState()
    clearInput()
    callbackRef.current.onStartRound()
    setHud({ score: 0, elapsed: 0, health: 3, difficulty: 1 })
    setPhase('playing')
    playSound('powerup')
    window.requestAnimationFrame(() => canvasRef.current?.focus())
  }, [clearInput, playSound])

  const pauseGame = useCallback(() => {
    clearInput()
    setPhase('paused')
    window.requestAnimationFrame(() => canvasRef.current?.focus())
  }, [clearInput])

  const resumeGame = useCallback(() => {
    setPhase('playing')
    window.requestAnimationFrame(() => canvasRef.current?.focus())
  }, [])

  const handleBack = useCallback(() => {
    if (phaseRef.current === 'playing' || phaseRef.current === 'paused') finishRef.current(gameRef.current)
    clearInput()
    onBack()
  }, [clearInput, onBack])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const context = canvas.getContext('2d')
    if (!context) return undefined

    const resize = () => {
      const bounds = canvas.getBoundingClientRect()
      const scale = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(bounds.width * scale))
      canvas.height = Math.max(1, Math.round(bounds.height * scale))
      context.setTransform(canvas.width / GAME_WIDTH, 0, 0, canvas.height / GAME_HEIGHT, 0, 0)
      drawScene(context, gameRef.current)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    canvasRef.current?.focus()
  }, [])

  useEffect(() => {
    if (phase !== 'playing') {
      const canvas = canvasRef.current
      const context = canvas?.getContext('2d')
      if (context) drawScene(context, gameRef.current)
      return undefined
    }

    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    const game = gameRef.current
    if (!context || !game) return undefined

    let frameId = 0
    let previousTime = 0
    let lastHudUpdate = 0
    const renderFrame = (timestamp) => {
      const delta = previousTime === 0 ? 0 : Math.min((timestamp - previousTime) / 1000, 0.05)
      previousTime = timestamp
      advanceGame(game, inputRef.current, delta)
      drawScene(context, game)

      for (const event of game.events) playSound(event)
      const unrecordedSeconds = Math.floor(game.elapsed) - game.savedSeconds
      if (unrecordedSeconds >= 10) {
        game.savedSeconds += unrecordedSeconds
        callbackRef.current.onRecordTime(unrecordedSeconds)
      }

      if (timestamp - lastHudUpdate >= 150) {
        lastHudUpdate = timestamp
        setHud({ score: game.score, elapsed: game.elapsed, health: game.player.health, difficulty: game.difficulty })
      }

      if (game.status === 'gameover') {
        setHud({ score: game.score, elapsed: game.elapsed, health: game.player.health, difficulty: game.difficulty })
        persistRun(game)
        setPhase('gameover')
        return
      }
      frameId = window.requestAnimationFrame(renderFrame)
    }
    frameId = window.requestAnimationFrame(renderFrame)
    return () => window.cancelAnimationFrame(frameId)
  }, [phase, persistRun, playSound])

  useEffect(() => {
    const handleBlur = () => {
      clearInput()
      if (phaseRef.current === 'playing') setPhase('paused')
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') handleBlur()
    }
    window.addEventListener('blur', handleBlur)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('blur', handleBlur)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [clearInput])

  useEffect(() => () => {
    if (phaseRef.current === 'playing' || phaseRef.current === 'paused') finishRef.current(gameRef.current)
    audioRef.current?.close().catch((error) => console.warn('Arcade-Audio konnte nicht geschlossen werden:', error))
  }, [])

  const handleKeyDown = (event) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
    const direction = keyMap[key]
    if (direction) {
      event.preventDefault()
      event.stopPropagation()
      if (phase === 'playing') inputRef.current[direction] = true
      return
    }
    if (event.code === 'Space') {
      event.preventDefault()
      event.stopPropagation()
      if (phase === 'playing') inputRef.current.shoot = true
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      if (phase === 'playing') pauseGame()
      else if (phase === 'paused') resumeGame()
      return
    }
    if (event.key === 'Enter' && (phase === 'ready' || phase === 'gameover')) {
      event.preventDefault()
      event.stopPropagation()
      startRun()
    } else if (event.key === 'Enter' && phase === 'paused') {
      event.preventDefault()
      event.stopPropagation()
      resumeGame()
    }
  }

  const handleKeyUp = (event) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
    const direction = keyMap[key]
    if (direction) inputRef.current[direction] = false
    if (event.code === 'Space') inputRef.current.shoot = false
  }

  const volumeControl = <label className="arcade-volume-control">
    <Icon name="spark" />
    <span>Sound</span>
    <input
      aria-label="Soundlautstärke"
      type="range"
      min="0"
      max="1"
      step="0.05"
      value={volume}
      onChange={(event) => onVolumeChange(Number(event.target.value))}
      onPointerUp={onVolumeSave}
      onKeyUp={onVolumeSave}
      onBlur={onVolumeSave}
    />
    <strong>{Math.round(volume * 100)}%</strong>
  </label>

  return <section className="arcade-page arcade-shooter-page">
    <header className="arcade-game-toolbar">
      <button type="button" className="arcade-back-button" onClick={handleBack}><Icon name="arrow" /> Zur Arcade</button>
      <div className="arcade-game-heading"><span className="section-kicker">VEXLOR ARCADE / SPIEL 01</span><h1>Space <span>Shooter</span></h1></div>
      {volumeControl}
    </header>

    <div className="arcade-shooter-status" aria-live="polite">
      <div><span>PUNKTE</span><strong>{hud.score.toLocaleString('de-DE')}</strong></div>
      <div><span>SPIELZEIT</span><strong>{formatClock(hud.elapsed)}</strong></div>
      <div><span>LEVEL</span><strong>{Math.floor(hud.difficulty)}</strong></div>
      <div className="arcade-lives"><span>LEBEN</span><strong>{'◆'.repeat(hud.health)}<i>{'◇'.repeat(3 - hud.health)}</i></strong></div>
      <button type="button" className="arcade-pause-button" onClick={phase === 'playing' ? pauseGame : resumeGame} disabled={phase !== 'playing' && phase !== 'paused'}>
        {phase === 'paused' ? 'Fortsetzen' : 'Ⅱ Pause'}
      </button>
    </div>

    <div className="arcade-arena">
      <canvas
        ref={canvasRef}
        tabIndex="0"
        aria-label="Spielfeld Vexlor Space Shooter. Bewege dein Schiff mit WASD oder den Pfeiltasten und schieße mit der Leertaste."
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onBlur={clearInput}
      />
      {phase !== 'playing' && <div className={`arcade-game-overlay ${phase}`}>
        {phase === 'ready' && <>
          <div className="arcade-overlay-kicker">MISSION BEREIT</div>
          <h2>Bereit zum Abheben?</h2>
          <p>Weiche den Gegnern aus, sammle Power-ups und halte so lange durch wie du kannst.</p>
          <button type="button" className="primary-button" onClick={startRun}>Spiel starten <Icon name="arrow" /></button>
          <span className="arcade-overlay-hint">EINGABETASTE ZUM STARTEN</span>
        </>}
        {phase === 'paused' && <>
          <div className="arcade-overlay-kicker">FLUG ANGEHALTEN</div>
          <h2>Pause</h2><p>Deine Runde wartet auf dich.</p>
          <button type="button" className="primary-button" onClick={resumeGame}>Weiterfliegen <Icon name="arrow" /></button>
          <span className="arcade-overlay-hint">ESC zum Fortsetzen</span>
        </>}
        {phase === 'gameover' && <>
          <div className="arcade-overlay-kicker">MISSION BEENDET</div>
          <h2>Runde beendet</h2><p>Du hast <strong>{hud.score.toLocaleString('de-DE')}</strong> Punkte erreicht.</p>
          <button type="button" className="primary-button" onClick={startRun}>Nochmal spielen <Icon name="refresh" /></button>
          <span className="arcade-overlay-hint">EINGABETASTE FÜR EINE NEUE RUNDE</span>
        </>}
      </div>}
    </div>

    <footer className="arcade-game-footer">
      <span><kbd>WASD</kbd> / <kbd>↑ ↓ ← →</kbd> Bewegen</span>
      <span><kbd>LEERTASTE</kbd> Schießen</span>
      <span><kbd>ESC</kbd> Pause</span>
      <span className="arcade-game-local"><i /> Spielstand wird lokal gespeichert</span>
    </footer>
  </section>
}

function drawScene(context, game) {
  if (!context) return
  const elapsed = game?.elapsed ?? 0
  const player = game?.player
  context.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
  const background = context.createLinearGradient(0, 0, 0, GAME_HEIGHT)
  background.addColorStop(0, '#08182c')
  background.addColorStop(1, '#050a14')
  context.fillStyle = background
  context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

  for (let index = 0; index < 86; index += 1) {
    const x = (index * 137 + 41) % GAME_WIDTH
    const speed = 14 + (index % 5) * 11
    const y = (index * 73 + elapsed * speed) % GAME_HEIGHT
    const radius = index % 9 === 0 ? 1.6 : 0.8
    context.globalAlpha = 0.25 + (index % 5) * 0.1
    context.fillStyle = index % 7 === 0 ? '#65e5ff' : '#d8eaff'
    context.fillRect(x, y, radius, radius * (index % 4 === 0 ? 2.8 : 1))
  }
  context.globalAlpha = 1
  context.strokeStyle = 'rgba(57, 141, 255, .09)'
  context.lineWidth = 1
  for (let y = 110; y < GAME_HEIGHT; y += 86) {
    context.beginPath()
    context.moveTo(0, y)
    context.lineTo(GAME_WIDTH, y)
    context.stroke()
  }

  if (game) {
    for (const bullet of game.bullets) {
      context.save()
      context.shadowColor = '#55e8ff'
      context.shadowBlur = 14
      context.fillStyle = '#c9fbff'
      context.beginPath()
      context.ellipse(bullet.x, bullet.y, 3, 10, 0, 0, Math.PI * 2)
      context.fill()
      context.restore()
    }

    for (const enemy of game.enemies) {
      const color = enemy.type === 'brute' ? '#ff7098' : enemy.type === 'asteroid' ? '#ffb46f' : enemy.type === 'weaver' ? '#b79aff' : '#ff647c'
      context.save()
      context.translate(enemy.x, enemy.y)
      context.rotate(enemy.type === 'asteroid' ? elapsed * 0.6 : Math.PI)
      context.shadowColor = color
      context.shadowBlur = 13
      context.fillStyle = `${color}30`
      context.strokeStyle = color
      context.lineWidth = 2
      context.beginPath()
      if (enemy.type === 'brute') {
        context.moveTo(0, -enemy.radius)
        context.lineTo(enemy.radius, -enemy.radius * 0.25)
        context.lineTo(enemy.radius * 0.75, enemy.radius)
        context.lineTo(-enemy.radius * 0.75, enemy.radius)
        context.lineTo(-enemy.radius, -enemy.radius * 0.25)
      } else if (enemy.type === 'asteroid') {
        for (let point = 0; point < 9; point += 1) {
          const angle = point / 9 * Math.PI * 2
          const radius = enemy.radius * (point % 2 ? 0.76 : 1)
          if (point === 0) context.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius)
          else context.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius)
        }
      } else {
        context.moveTo(0, -enemy.radius)
        context.lineTo(enemy.radius, enemy.radius * 0.65)
        context.lineTo(0, enemy.radius * 0.25)
        context.lineTo(-enemy.radius, enemy.radius * 0.65)
      }
      context.closePath()
      context.fill()
      context.stroke()
      context.restore()
    }

    for (const powerUp of game.powerUps) {
      const color = powerUp.type === 'repair' ? '#41dba0' : powerUp.type === 'shield' ? '#51caff' : '#f5d365'
      context.save()
      context.shadowColor = color
      context.shadowBlur = 14
      context.fillStyle = `${color}33`
      context.strokeStyle = color
      context.lineWidth = 2
      context.beginPath()
      context.arc(powerUp.x, powerUp.y, powerUp.radius, 0, Math.PI * 2)
      context.fill()
      context.stroke()
      context.fillStyle = '#f2f8ff'
      context.font = '700 11px sans-serif'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText(powerUp.type === 'repair' ? '+' : powerUp.type === 'shield' ? 'S' : 'R', powerUp.x, powerUp.y)
      context.restore()
    }

    if (player) {
      context.save()
      context.translate(player.x, player.y)
      if (player.invulnerable > 0 && Math.floor(elapsed * 16) % 2 === 0) context.globalAlpha = 0.35
      if (player.shieldUntil > elapsed) {
        context.strokeStyle = 'rgba(74, 205, 255, .75)'
        context.lineWidth = 2
        context.shadowColor = '#4acfff'
        context.shadowBlur = 18
        context.beginPath()
        context.arc(0, 0, 27, 0, Math.PI * 2)
        context.stroke()
      }
      context.shadowColor = '#50bfff'
      context.shadowBlur = 18
      context.fillStyle = '#c8f4ff'
      context.strokeStyle = '#54bcff'
      context.lineWidth = 2
      context.beginPath()
      context.moveTo(0, -19)
      context.lineTo(15, 13)
      context.lineTo(4, 9)
      context.lineTo(0, 17)
      context.lineTo(-4, 9)
      context.lineTo(-15, 13)
      context.closePath()
      context.fill()
      context.stroke()
      context.fillStyle = '#38d8e6'
      context.beginPath()
      context.moveTo(-4, 14)
      context.lineTo(0, 25 + Math.sin(elapsed * 32) * 4)
      context.lineTo(4, 14)
      context.fill()
      context.restore()
    }

    context.fillStyle = 'rgba(5, 11, 20, .74)'
    context.fillRect(0, 0, GAME_WIDTH, 52)
    context.strokeStyle = 'rgba(116, 173, 235, .15)'
    context.beginPath()
    context.moveTo(0, 52)
    context.lineTo(GAME_WIDTH, 52)
    context.stroke()
    context.fillStyle = '#7890ad'
    context.font = '500 10px monospace'
    context.textAlign = 'left'
    context.fillText('PUNKTE', 24, 21)
    context.fillText('ZEIT', 230, 21)
    context.fillText('SEKTOR', 405, 21)
    context.fillText('LEBEN', 595, 21)
    context.fillStyle = '#e9f4ff'
    context.font = '600 19px sans-serif'
    context.fillText(game.score.toLocaleString('de-DE'), 24, 43)
    context.fillText(formatClock(elapsed), 230, 43)
    context.fillText(`${Math.floor(game.difficulty).toString().padStart(2, '0')}`, 405, 43)
    context.fillStyle = '#62d8ef'
    context.fillText('◆'.repeat(player.health), 595, 43)
    context.fillStyle = '#354355'
    context.fillText('◇'.repeat(player.maxHealth - player.health), 595 + player.health * 17, 43)
    context.textAlign = 'right'
    context.fillStyle = '#70859f'
    context.font = '500 10px monospace'
    context.fillText('VEXLOR ARCADE', GAME_WIDTH - 24, 31)
  }
}
