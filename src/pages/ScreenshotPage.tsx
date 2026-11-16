import { useEffect, useState, type KeyboardEvent } from 'react'
import { Icon } from '../components/Icon'
import type { ScreenshotDisplay, ScreenshotShortcutStatus, ScreenshotWindow } from '../types/app'

interface ScreenshotPageProps {
  initialImage: string | null
  notifyError: (message: string) => void
  notifyInfo: (message: string) => void
}

type CaptureMode = 'region' | 'display' | 'window'

export function ScreenshotPage({ initialImage, notifyError, notifyInfo }: ScreenshotPageProps) {
  const [mode, setMode] = useState<CaptureMode>('region')
  const [image, setImage] = useState<string | null>(initialImage)
  const [displays, setDisplays] = useState<ScreenshotDisplay[]>([])
  const [selectedDisplay, setSelectedDisplay] = useState('')
  const [windows, setWindows] = useState<ScreenshotWindow[]>([])
  const [selectedWindow, setSelectedWindow] = useState('')
  const [shortcut, setShortcut] = useState('Super+Shift+S')
  const [shortcutStatus, setShortcutStatus] = useState<ScreenshotShortcutStatus | null>(null)
  const [recordingShortcut, setRecordingShortcut] = useState(false)
  const [shortcutDirty, setShortcutDirty] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [busy, setBusy] = useState(false)
  const [loadingWindows, setLoadingWindows] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([window.vcc.listScreenshotDisplays(), window.vcc.getScreenshotShortcut()])
      .then(([availableDisplays, status]) => {
        if (!active) return
        setDisplays(availableDisplays)
        setSelectedDisplay(availableDisplays.find((display) => display.primary)?.id ?? availableDisplays[0]?.id ?? '')
        setShortcut(status.shortcut)
        setShortcutStatus(status)
      })
      .catch((error: unknown) => notifyError(error instanceof Error ? error.message : 'Screenshot-Einstellungen konnten nicht geladen werden.'))
    return () => { active = false }
  }, [notifyError])

  useEffect(() => {
    if (initialImage) {
      setImage(initialImage)
      setZoom(100)
    }
  }, [initialImage])

  useEffect(() => {
    if (mode === 'window') void refreshWindows()
  }, [mode])

  const refreshWindows = async () => {
    setLoadingWindows(true)
    try {
      const availableWindows = await window.vcc.listScreenshotWindows()
      setWindows(availableWindows)
      setSelectedWindow((current) => availableWindows.some((item) => item.id === current) ? current : availableWindows[0]?.id ?? '')
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Fensterliste konnte nicht geladen werden.')
    } finally {
      setLoadingWindows(false)
    }
  }

  const capture = async () => {
    if (busy) return
    setBusy(true)
    try {
      let nextImage: string | null
      if (mode === 'region') nextImage = await window.vcc.captureScreenshotRegion()
      else if (mode === 'display') {
        if (!selectedDisplay) throw new Error('Es wurde kein Bildschirm gefunden.')
        nextImage = await window.vcc.captureScreenshotDisplay(selectedDisplay)
      } else {
        if (!selectedWindow) throw new Error('Bitte zuerst ein Fenster auswählen.')
        nextImage = await window.vcc.captureScreenshotWindow(selectedWindow)
      }

      if (nextImage) {
        setImage(nextImage)
        setZoom(100)
      }
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Screenshot konnte nicht erstellt werden.')
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!image || busy) return
    setBusy(true)
    try {
      if (await window.vcc.saveScreenshot(image)) notifyInfo('Screenshot wurde als PNG gespeichert.')
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Screenshot konnte nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!image || busy) return
    setBusy(true)
    try {
      await window.vcc.copyScreenshot(image)
      notifyInfo('Screenshot wurde in die Zwischenablage kopiert.')
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Screenshot konnte nicht kopiert werden.')
    } finally {
      setBusy(false)
    }
  }

  const recordShortcut = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!recordingShortcut) return
    event.preventDefault()
    event.stopPropagation()
    const key = shortcutKey(event)
    if (!key) return
    const modifiers = [
      event.ctrlKey && 'Ctrl',
      event.altKey && 'Alt',
      event.shiftKey && 'Shift',
      event.metaKey && 'Super',
    ].filter(Boolean) as string[]
    if (modifiers.length === 0) {
      notifyError('Die Tastenkombination muss mindestens einen Modifier wie Strg, Alt oder Shift enthalten.')
      return
    }
    setShortcut([...modifiers, key].join('+'))
    setShortcutDirty(true)
    setRecordingShortcut(false)
  }

  const saveShortcut = async () => {
    try {
      const status = await window.vcc.setScreenshotShortcut(shortcut)
      setShortcutStatus(status)
      setShortcutDirty(false)
      notifyInfo(`Screenshot-Tastenkombination ${displayShortcut(status.shortcut)} wurde gespeichert.`)
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Tastenkombination konnte nicht registriert werden.')
    }
  }

  const selectedWindowPreview = windows.find((item) => item.id === selectedWindow)

  return <>
    <div className="page-intro screenshot-page-intro">
      <div>
        <div className="eyebrow"><span className="eyebrow-line" /> WINDOWS CAPTURE</div>
        <h1>Screenshot <span>Tool</span></h1>
        <p className="welcome-subtitle">Bildschirm, Fenster oder einen frei gewählten Bereich aufnehmen.</p>
      </div>
      <div className="screenshot-shortcut-status"><span className={shortcutStatus?.registered ? 'shortcut-status-dot active' : 'shortcut-status-dot'} />{shortcutStatus?.registered ? 'TASTENKÜRZEL AKTIV' : 'TASTENKÜRZEL NICHT VERFÜGBAR'}</div>
    </div>

    <div className="screenshot-layout">
      <section className="screenshot-capture-column">
        <div className="screenshot-capture-card panel">
          <div className="panel-heading">
            <div><div className="section-kicker">AUFNAHMEMODUS</div><h2>Was möchtest du aufnehmen?</h2></div>
            <span className="screenshot-mode-mark"><Icon name="screenshot" /></span>
          </div>
          <div className="screenshot-mode-tabs" role="tablist" aria-label="Screenshot-Aufnahmemodus">
            <button className={mode === 'region' ? 'active' : ''} role="tab" aria-selected={mode === 'region'} onClick={() => setMode('region')}><Icon name="screenshot" />Bereich</button>
            <button className={mode === 'display' ? 'active' : ''} role="tab" aria-selected={mode === 'display'} onClick={() => setMode('display')}><Icon name="monitor" />Bildschirm</button>
            <button className={mode === 'window' ? 'active' : ''} role="tab" aria-selected={mode === 'window'} onClick={() => setMode('window')}><Icon name="windows" />Fenster</button>
          </div>

          {mode === 'region' && <div className="screenshot-mode-content">
            <div className="screenshot-mode-icon"><Icon name="screenshot" /></div>
            <h3>Freien Bereich auswählen</h3>
            <p>Der Bildschirm wird kurz abgedunkelt. Ziehe mit der linken Maustaste ein Rechteck auf und bestätige mit Enter. Esc bricht ab.</p>
            <button className="primary-button screenshot-capture-button" onClick={() => void capture()} disabled={busy}><Icon name="screenshot" />{busy ? 'Bereichsauswahl läuft …' : 'Bereich auswählen'}</button>
          </div>}

          {mode === 'display' && <div className="screenshot-mode-content">
            <div className="screenshot-mode-icon"><Icon name="monitor" /></div>
            <h3>Vollständigen Bildschirm aufnehmen</h3>
            <p>Wähle einen Monitor aus. Die Aufnahme berücksichtigt dessen Auflösung und Windows-DPI-Skalierung.</p>
            <label className="screenshot-select-label">Bildschirm
              <select value={selectedDisplay} onChange={(event) => setSelectedDisplay(event.target.value)} disabled={displays.length === 0}>
                {displays.map((display) => <option key={display.id} value={display.id}>{display.label}</option>)}
              </select>
            </label>
            <button className="primary-button screenshot-capture-button" onClick={() => void capture()} disabled={busy || displays.length === 0}><Icon name="screenshot" />{busy ? 'Wird aufgenommen …' : 'Bildschirm aufnehmen'}</button>
          </div>}

          {mode === 'window' && <div className="screenshot-mode-content screenshot-window-content">
            <div className="screenshot-mode-icon"><Icon name="windows" /></div>
            <h3>Offenes Fenster aufnehmen</h3>
            <p>Wähle ein geöffnetes Fenster. Die Fensterliste wird lokal von Windows geladen.</p>
            <div className="screenshot-window-picker">
              {selectedWindowPreview && <img src={selectedWindowPreview.thumbnail} alt="" />}
              <select value={selectedWindow} onChange={(event) => setSelectedWindow(event.target.value)} disabled={loadingWindows || windows.length === 0} aria-label="Fenster auswählen">
                {windows.length === 0 && <option value="">{loadingWindows ? 'Fenster werden gesucht …' : 'Keine Fenster gefunden'}</option>}
                {windows.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
              <button className="subtle-button screenshot-refresh" onClick={() => void refreshWindows()} disabled={loadingWindows} aria-label="Fensterliste aktualisieren" title="Fensterliste aktualisieren"><Icon name="refresh" /></button>
            </div>
            <button className="primary-button screenshot-capture-button" onClick={() => void capture()} disabled={busy || loadingWindows || !selectedWindow}><Icon name="screenshot" />{busy ? 'Wird aufgenommen …' : 'Fenster aufnehmen'}</button>
          </div>}
        </div>

        <div className="screenshot-shortcut-card panel">
          <div className="screenshot-shortcut-heading"><span className="screenshot-shortcut-icon"><Icon name="spark" /></span><div><div className="section-kicker">SCHNELLZUGRIFF</div><h2>Tastenkombination</h2></div></div>
          <p>Starte die Bereichsauswahl jederzeit, auch wenn Vexlor im Hintergrund läuft.</p>
          <div className="screenshot-shortcut-controls">
            <button className={`screenshot-key-input${recordingShortcut ? ' recording' : ''}`} onClick={() => setRecordingShortcut(true)} onKeyDown={recordShortcut}>
              {recordingShortcut ? 'Tasten drücken …' : displayShortcut(shortcut)}
            </button>
            <button className="primary-button screenshot-shortcut-save" onClick={() => void saveShortcut()} disabled={!shortcutDirty}>Speichern</button>
          </div>
          <div className="screenshot-shortcut-note">
            {shortcutStatus?.registered
              ? `Aktiv: ${displayShortcut(shortcutStatus.shortcut)}`
              : 'Win + Shift + S wird häufig von Windows reserviert. Wähle bei Bedarf eine andere Kombination, z. B. Strg + Shift + X.'}
          </div>
        </div>
      </section>

      <section className="screenshot-preview-card panel">
        <div className="panel-heading screenshot-preview-heading">
          <div><div className="section-kicker">VORSCHAU</div><h2>{image ? 'Dein Screenshot' : 'Noch keine Aufnahme'}</h2></div>
          {image && <div className="screenshot-zoom-controls"><button onClick={() => setZoom((value) => Math.max(50, value - 10))} disabled={zoom <= 50} aria-label="Verkleinern"><Icon name="zoomOut" /></button><input type="range" min="50" max="200" step="10" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} aria-label="Zoom" /><span>{zoom} %</span><button onClick={() => setZoom((value) => Math.min(200, value + 10))} disabled={zoom >= 200} aria-label="Vergrößern"><Icon name="zoomIn" /></button></div>}
        </div>
        <div className={`screenshot-preview-viewport${image ? ' has-image' : ''}`}>
          {image
            ? <img src={image} alt="Vorschau des aufgenommenen Screenshots" style={{ width: `${zoom}%` }} />
            : <div className="screenshot-preview-empty"><span><Icon name="screenshot" /></span><strong>Dein Screenshot erscheint hier</strong><small>Wähle links einen Aufnahmemodus, um zu starten.</small></div>}
        </div>
        <div className="screenshot-preview-footer">
          <span>{image ? 'PNG · lokal auf diesem PC' : 'Keine Aufnahme vorhanden'}</span>
          <div><button className="subtle-button" onClick={() => void copy()} disabled={!image || busy}><Icon name="copy" />Kopieren</button><button className="primary-button" onClick={() => void save()} disabled={!image || busy}><Icon name="save" />Speichern als PNG</button></div>
        </div>
      </section>
    </div>
  </>
}

function shortcutKey(event: KeyboardEvent<HTMLButtonElement>): string | null {
  if (/^[a-z]$/i.test(event.key)) return event.key.toUpperCase()
  if (/^[0-9]$/.test(event.key)) return event.key
  if (/^F(?:[1-9]|1[0-2])$/.test(event.key)) return event.key
  if (event.key === 'PrintScreen') return 'PrintScreen'
  if (event.code === 'Space') return 'Space'
  if (event.code === 'Comma') return 'Comma'
  if (event.code === 'Period') return 'Period'
  if (event.code === 'NumpadAdd') return 'Plus'
  if (event.code === 'NumpadSubtract') return 'Minus'
  return null
}

function displayShortcut(shortcut: string): string {
  return shortcut.replaceAll('Super', 'Win').replaceAll('Ctrl', 'Strg')
}
