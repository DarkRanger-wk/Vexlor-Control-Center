import QRCode from 'qrcode'
import { useEffect, useState, type FormEvent } from 'react'
import { Icon } from '../components/Icon'
import { calculateExpression } from '../services/calculator'
import type { TimerWidgetState } from '../types/app'
import { PageIntro } from './LibraryPage'

interface ToolsPageProps {
  notifyError: (message: string) => void
  onNavigate: (page: string) => void
  timer: TimerWidgetState['timer']
  stopwatch: TimerWidgetState['stopwatch']
  onTimerChange: (timer: TimerWidgetState['timer']) => void
  onStopwatchChange: (stopwatch: TimerWidgetState['stopwatch']) => void
}

export function ToolsPage({ notifyError, onNavigate, timer, stopwatch, onTimerChange, onStopwatchChange }: ToolsPageProps) {
  return <>
    <PageIntro eyebrow="PRAKTISCHE EXTRAS" title="Gaming Tools" description="Kleine Werkzeuge für deine Gaming-Sessions – Berechnung, Zeit, Notizen und QR-Codes lokal auf deinem PC." />
    <div className="tools-grid">
      <CalculatorTool />
      <TimerTool notifyError={notifyError} timer={timer} onChange={onTimerChange} />
      <StopwatchTool stopwatch={stopwatch} onChange={onStopwatchChange} />
      <NotesTool notifyError={notifyError} />
      <QrTool notifyError={notifyError} />
      <section className="tool-card panel shortcuts-card"><ToolHeading icon="spark" kicker="SCHNELLZUGRIFF" title="Dein Setup" /><p>Direkt zu den häufig genutzten Bereichen.</p><div className="shortcut-list"><button onClick={() => onNavigate('Spielebibliothek')}><Icon name="library" />Spielebibliothek<Icon className="quick-arrow" name="arrow" /></button><button onClick={() => onNavigate('Performance')}><Icon name="performance" />Performance Center<Icon className="quick-arrow" name="arrow" /></button><button onClick={() => onNavigate('Network Center')}><Icon name="network" />Network Center<Icon className="quick-arrow" name="arrow" /></button></div></section>
    </div>
  </>
}

function CalculatorTool() {
  const [expression, setExpression] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState('')

  const calculate = (event: FormEvent) => {
    event.preventDefault()
    try {
      setResult(calculateExpression(expression).toLocaleString('de-DE', { maximumFractionDigits: 10 }))
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Berechnung fehlgeschlagen.')
      setResult(null)
    }
  }

  return <section className="tool-card panel"><ToolHeading icon="cpu" kicker="RECHNER" title="Taschenrechner" /><form onSubmit={calculate}><label className="tool-input-label">Ausdruck<input aria-label="Mathematischer Ausdruck" value={expression} onChange={(event) => setExpression(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.form?.requestSubmit() }} placeholder="z. B. (120 + 45) / 3" /></label><button className="primary-button tool-submit">Berechnen</button></form>{error && <p className="tool-error" role="alert">{error}</p>}{result !== null && <div className="calculation-result"><span>ERGEBNIS</span><strong>{result}</strong></div>}<p className="tool-hint">Unterstützt + − × ÷, Dezimalzahlen und Klammern.</p></section>
}

function TimerTool({ notifyError, timer, onChange }: {
  notifyError: (message: string) => void
  timer: TimerWidgetState['timer']
  onChange: (timer: TimerWidgetState['timer']) => void
}) {
  const [minutes, setMinutes] = useState('10')
  const [seconds, setSeconds] = useState('00')

  const start = () => {
    if (timer.status === 'running' && timer.deadline !== null) {
      const remainingMs = Math.max(0, timer.deadline - Date.now())
      onChange({
        status: remainingMs === 0 ? 'completed' : 'paused',
        remainingMs,
        deadline: remainingMs === 0 ? timer.deadline : null,
      })
      return
    }
    const duration = timer.status === 'paused' ? timer.remainingMs : (Number(minutes) * 60 + Number(seconds)) * 1000
    if (!Number.isFinite(duration) || duration <= 0 || duration > 24 * 60 * 60 * 1000) {
      notifyError('Bitte eine Timer-Dauer zwischen 1 Sekunde und 24 Stunden eingeben.')
      return
    }
    onChange({ status: 'running', remainingMs: duration, deadline: Date.now() + duration })
  }

  const running = timer.status === 'running'
  const completed = timer.status === 'completed'
  const paused = timer.status === 'paused'
  const clockValue = running && timer.deadline !== null
    ? Math.max(0, timer.deadline - Date.now())
    : completed
      ? 0
      : paused
        ? timer.remainingMs
        : (Number(minutes) * 60 + Number(seconds)) * 1000
  const clockText = formatDuration(clockValue)
  return <section className="tool-card panel"><ToolHeading icon="refresh" kicker="SESSION-PLANUNG" title="Timer" /><div className={`tool-clock${running ? ' active' : ''}`}>{clockText}</div><div className="timer-fields"><label>Min<input type="number" min="0" max="1439" disabled={running || paused} value={minutes} onChange={(event) => setMinutes(event.target.value)} /></label><span>:</span><label>Sek<input type="number" min="0" max="59" disabled={running || paused} value={seconds} onChange={(event) => setSeconds(event.target.value)} /></label></div><div className="tool-button-row"><button className="primary-button" onClick={start}>{running ? 'Pausieren' : paused ? 'Fortsetzen' : completed ? 'Erneut starten' : 'Starten'}</button><button className="subtle-button" onClick={() => onChange({ status: 'idle', remainingMs: 0, deadline: null })}>Zurücksetzen</button></div><p className="tool-hint">{completed ? 'Timer abgelaufen.' : running ? 'Läuft auch bei geschlossenem Hauptfenster.' : 'Der Timer bleibt im schwebenden Fenster sichtbar.'}</p></section>
}

function StopwatchTool({ stopwatch, onChange }: {
  stopwatch: TimerWidgetState['stopwatch']
  onChange: (stopwatch: TimerWidgetState['stopwatch']) => void
}) {
  const running = stopwatch.running
  const elapsed = running && stopwatch.startedAt !== null
    ? Math.max(0, Date.now() - stopwatch.startedAt)
    : stopwatch.elapsedMs
  const toggle = () => {
    if (running) {
      onChange({ running: false, elapsedMs: elapsed, startedAt: null })
    } else {
      onChange({ running: true, elapsedMs: elapsed, startedAt: Date.now() - elapsed })
    }
  }

  return <section className="tool-card panel"><ToolHeading icon="performance" kicker="ZEITMESSUNG" title="Stoppuhr" /><div className={`tool-clock${running ? ' active' : ''}`}>{formatStopwatch(elapsed)}</div><div className="tool-button-row"><button className="primary-button" onClick={toggle}>{running ? 'Stoppen' : elapsed > 0 ? 'Fortsetzen' : 'Starten'}</button><button className="subtle-button" onClick={() => onChange({ running: false, elapsedMs: 0, startedAt: null })}>Zurücksetzen</button></div><p className="tool-hint">{running ? 'Läuft auch bei geschlossenem Hauptfenster.' : 'Die Stoppuhr bleibt im schwebenden Fenster sichtbar.'}</p></section>
}

function NotesTool({ notifyError }: { notifyError: (message: string) => void }) {
  const [notes, setNotes] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    window.vcc.getNotes().then((value) => {
      if (active) {
        setNotes(value)
        setLoaded(true)
      }
    }).catch((error: unknown) => notifyError(error instanceof Error ? error.message : 'Notizen konnten nicht geladen werden.'))
    return () => { active = false }
  }, [notifyError])

  useEffect(() => {
    if (!loaded) return
    const timer = window.setTimeout(() => {
      window.vcc.saveNotes(notes).then(() => setSavedAt(Date.now())).catch((error: unknown) => notifyError(error instanceof Error ? error.message : 'Notizen konnten nicht gespeichert werden.'))
    }, 350)
    return () => window.clearTimeout(timer)
  }, [loaded, notes, notifyError])

  return <section className="tool-card panel notes-card"><ToolHeading icon="library" kicker="SESSION-NOTIZEN" title="Notizen" /><textarea aria-label="Lokal gespeicherte Notizen" maxLength={50000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notiere dir Builds, Ziele oder Ideen für deine nächste Session …" /><div className="notes-footer"><span>{loaded ? savedAt ? `Lokal gespeichert · ${new Date(savedAt).toLocaleTimeString('de-DE')}` : 'Änderungen werden lokal gespeichert …' : 'Notizen werden geladen …'}</span><span>{notes.length.toLocaleString('de-DE')} / 50.000</span></div></section>
}

function QrTool({ notifyError }: { notifyError: (message: string) => void }) {
  const [value, setValue] = useState('')
  const [image, setImage] = useState('')
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!value.trim()) {
      setImage('')
      return
    }
    let active = true
    setGenerating(true)
    QRCode.toDataURL(value, { width: 240, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#e8edf7', light: '#101a2a' } })
      .then((data) => { if (active) setImage(data) })
      .catch((error: unknown) => { if (active) notifyError(error instanceof Error ? error.message : 'QR-Code konnte nicht erzeugt werden.') })
      .finally(() => { if (active) setGenerating(false) })
    return () => { active = false }
  }, [value, notifyError])

  return <section className="tool-card panel qr-card"><ToolHeading icon="network" kicker="OFFLINE ERZEUGT" title="QR-Code Generator" /><label className="tool-input-label">Text oder Link<input value={value} maxLength={2000} onChange={(event) => setValue(event.target.value)} placeholder="https:// oder beliebiger Text" /></label><div className="qr-preview">{image ? <img src={image} alt={`QR-Code für ${value}`} /> : <div><Icon name="network" /><span>{generating ? 'Wird erzeugt …' : 'Vorschau erscheint hier'}</span></div>}</div><p className="tool-hint">Die Eingabe wird lokal verarbeitet und nicht übertragen.</p></section>
}

function ToolHeading({ icon, kicker, title }: { icon: 'cpu' | 'refresh' | 'performance' | 'library' | 'network' | 'spark'; kicker: string; title: string }) {
  return <div className="tool-heading"><span><Icon name={icon} /></span><div><div className="section-kicker">{kicker}</div><h2>{title}</h2></div></div>
}

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.ceil(Math.max(0, milliseconds) / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatStopwatch(milliseconds: number): string {
  const minutes = Math.floor(milliseconds / 60000)
  const seconds = Math.floor((milliseconds % 60000) / 1000)
  const centiseconds = Math.floor((milliseconds % 1000) / 10)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`
}
