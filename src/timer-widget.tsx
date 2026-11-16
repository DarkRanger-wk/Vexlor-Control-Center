import { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import type { TimerWidgetState } from './types/app'
import './styles/timer-widget.css'

const idleState: TimerWidgetState = {
  timer: { status: 'idle', remainingMs: 0, deadline: null },
  stopwatch: { running: false, elapsedMs: 0, startedAt: null },
}

function TimerWidget() {
  const [state, setState] = useState(idleState)
  const [now, setNow] = useState(Date.now())
  const [alarmError, setAlarmError] = useState(false)
  const lastAlarmDeadline = useRef<number | null>(null)

  useEffect(() => window.vccTimerWidget.onState(setState), [])
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 50)
    return () => window.clearInterval(interval)
  }, [])

  const timerDeadline = state.timer.deadline
  const timerExpired = state.timer.status === 'running' && timerDeadline !== null && now >= timerDeadline
  const timerCompleted = state.timer.status === 'completed'
  useEffect(() => {
    lastAlarmDeadline.current = null
    setAlarmError(false)
  }, [timerDeadline])
  useEffect(() => {
    if ((!timerExpired && !timerCompleted) || timerDeadline === null || lastAlarmDeadline.current === timerDeadline) return
    lastAlarmDeadline.current = timerDeadline
    void playAlarm().then((played) => setAlarmError(!played))
  }, [timerCompleted, timerExpired, timerDeadline])

  const timerRunning = state.timer.status === 'running' && !timerExpired
  const timerValue = timerRunning && timerDeadline !== null ? Math.max(0, timerDeadline - now) : state.timer.remainingMs
  const stopwatchValue = state.stopwatch.running && state.stopwatch.startedAt !== null
    ? Math.max(0, now - state.stopwatch.startedAt)
    : state.stopwatch.elapsedMs
  const timerVisible = state.timer.status !== 'idle'
  const stopwatchVisible = state.stopwatch.running || state.stopwatch.elapsedMs > 0

  return <main className="timer-widget">
    <header className="timer-widget-header">
      <span className="timer-widget-logo">V</span>
      <span className="timer-widget-brand">VEXLOR <small>FOCUS PANEL</small></span>
      <button className="timer-widget-open" onClick={() => window.vccTimerWidget.action('open-app')} title="Vexlor Control Center öffnen">VCC öffnen <span>↗</span></button>
    </header>
    {timerVisible && <section className={`timer-widget-row${timerExpired || timerCompleted ? ' complete' : ''}`}>
      <div className={`timer-widget-indicator${timerRunning ? ' running' : ''}`} />
      <div className="timer-widget-copy"><span>TIMER</span><strong>{formatTimer(timerExpired ? 0 : timerValue)}</strong></div>
      <span className="timer-widget-status">{alarmError ? 'Signalton nicht verfügbar' : timerExpired || timerCompleted ? 'Abgelaufen' : state.timer.status === 'paused' ? 'Pausiert' : 'Läuft'}</span>
      <div className="timer-widget-actions">
        {!timerCompleted && <button onClick={() => window.vccTimerWidget.action('timer-toggle')} title={timerRunning ? 'Timer pausieren' : 'Timer fortsetzen'}>{timerRunning ? 'Ⅱ' : '▶'}</button>}
        <button onClick={() => window.vccTimerWidget.action('timer-reset')} title="Timer zurücksetzen">↺</button>
      </div>
    </section>}
    {stopwatchVisible && <section className="timer-widget-row">
      <div className={`timer-widget-indicator stopwatch${state.stopwatch.running ? ' running' : ''}`} />
      <div className="timer-widget-copy"><span>STOPPUHR</span><strong>{formatStopwatch(stopwatchValue)}</strong></div>
      <span className="timer-widget-status">{state.stopwatch.running ? 'Läuft' : 'Pausiert'}</span>
      <div className="timer-widget-actions">
        <button onClick={() => window.vccTimerWidget.action('stopwatch-toggle')} title={state.stopwatch.running ? 'Stoppuhr pausieren' : 'Stoppuhr fortsetzen'}>{state.stopwatch.running ? 'Ⅱ' : '▶'}</button>
        <button onClick={() => window.vccTimerWidget.action('stopwatch-reset')} title="Stoppuhr zurücksetzen">↺</button>
      </div>
    </section>}
    {!timerVisible && !stopwatchVisible && <div className="timer-widget-empty">Timer und Stoppuhr sind beendet.</div>}
  </main>
}

async function playAlarm(): Promise<boolean> {
  try {
    const context = new AudioContext()
    await context.resume()
    const start = context.currentTime
    ;[880, 660, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const noteStart = start + index * 0.34
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, noteStart)
      gain.gain.exponentialRampToValueAtTime(0.22, noteStart + 0.025)
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.24)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(noteStart)
      oscillator.stop(noteStart + 0.25)
    })
    window.setTimeout(() => { void context.close() }, 1400)
    return true
  } catch (error) {
    console.error('Timer-Signalton konnte nicht erzeugt werden.', error)
    return false
  }
}

function formatTimer(milliseconds: number): string {
  const seconds = Math.ceil(Math.max(0, milliseconds) / 1000)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function formatStopwatch(milliseconds: number): string {
  const minutes = Math.floor(milliseconds / 60000)
  const seconds = Math.floor((milliseconds % 60000) / 1000)
  const centiseconds = Math.floor((milliseconds % 1000) / 10)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`
}

ReactDOM.createRoot(document.getElementById('timer-widget-root')!).render(<TimerWidget />)
