import { useCallback, useEffect, useRef, useState } from 'react'
import packageJson from '../../package.json'
import { Icon } from '../components/Icon'
import { Sidebar } from '../components/Sidebar'
import type { AppSettings, TimerWidgetAction, TimerWidgetState } from '../types/app'
import { DashboardPage } from './DashboardPage'
import { LibraryPage } from './LibraryPage'
import { NetworkPage, PerformancePage, SystemMonitorPage } from './SystemPages'
import { AboutPage, CustomizationPage, LegalPage, SettingsPage } from './SettingsPage'
import { ToolsPage } from './ToolsPage'
import { ScreenshotPage } from './ScreenshotPage'
import ArcadePage from './ArcadePage.jsx'

const defaultSettings: AppSettings = {
  accent: '#428bff',
  theme: 'navy',
  animations: true,
  compactSidebar: false,
  backgroundData: null,
  notifications: true,
  launchAtLogin: false,
  autoCheckUpdates: true,
  telemetryEnabled: false,
  screenshotShortcut: 'Ctrl+Shift+S',
}

const idleTimerWidgetState: TimerWidgetState = {
  timer: { status: 'idle', remainingMs: 0, deadline: null },
  stopwatch: { running: false, elapsedMs: 0, startedAt: null },
}

export default function App() {
  const [page, setPage] = useState('Dashboard')
  const [settings, setSettings] = useState(defaultSettings)
  const [availableUpdate, setAvailableUpdate] = useState<{ tag: string; hasInstaller: boolean } | null>(null)
  const [installingUpdate, setInstallingUpdate] = useState(false)
  const [checkingUpdates, setCheckingUpdates] = useState(false)
  const [toast, setToast] = useState<{ message: string; kind: 'error' | 'info' } | null>(null)
  const [hotkeyScreenshot, setHotkeyScreenshot] = useState<string | null>(null)
  const [timerWidgetState, setTimerWidgetState] = useState(idleTimerWidgetState)
  const lastWidgetState = useRef('')
  const notifiedUpdateTag = useRef<string | null>(null)

  const notifyError = useCallback((message: string) => setToast({ message, kind: 'error' }), [])
  const notifyInfo = useCallback((message: string) => setToast({ message, kind: 'info' }), [])

  useEffect(() => {
    let active = true
    window.vcc.getSettings().then((saved) => {
      if (!active) return
      setSettings(saved)
    }).catch((error: unknown) => {
      if (active) notifyError(error instanceof Error ? error.message : 'Einstellungen konnten nicht geladen werden.')
    })
    return () => { active = false }
  }, [notifyError])

  useEffect(() => {
    if (!settings.autoCheckUpdates) return
    let active = true
    const checkForUpdates = async () => {
      if (active) setCheckingUpdates(true)
      try {
        const update = await window.vcc.checkUpdates()
        if (!active) return
        if (update.updateAvailable && update.latestVersion) {
          setAvailableUpdate({ tag: update.latestVersion, hasInstaller: Boolean(update.downloadUrl) })
          if (settings.notifications && notifiedUpdateTag.current !== update.latestVersion) {
            notifiedUpdateTag.current = update.latestVersion
            notifyInfo(update.downloadUrl
              ? `Version ${update.latestVersion} ist verfügbar und kann oben rechts installiert werden.`
              : `Version ${update.latestVersion} ist verfügbar. Der Release enthält keinen Installer.`)
          }
        } else {
          setAvailableUpdate(null)
        }
      } catch (error) {
        if (active) console.warn('Automatische Updateprüfung fehlgeschlagen:', error)
      } finally {
        if (active) setCheckingUpdates(false)
      }
    }

    void checkForUpdates()
    const interval = window.setInterval(() => void checkForUpdates(), 6 * 60 * 60 * 1000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [settings.autoCheckUpdates, settings.notifications, notifyError, notifyInfo])

  useEffect(() => {
    const unsubscribeCaptured = window.vcc.onScreenshotCaptured((image) => {
      setHotkeyScreenshot(image)
      setPage('Screenshot Tool')
      setToast({ message: 'Screenshot aufgenommen. Du kannst ihn jetzt speichern oder kopieren.', kind: 'info' })
    })
    const unsubscribeError = window.vcc.onScreenshotError(notifyError)
    return () => {
      unsubscribeCaptured()
      unsubscribeError()
    }
  }, [notifyError])

  useEffect(() => {
    if (timerWidgetState.timer.status !== 'running' || timerWidgetState.timer.deadline === null) return
    const deadline = timerWidgetState.timer.deadline
    const interval = window.setInterval(() => {
      const remainingMs = Math.max(0, deadline - Date.now())
      setTimerWidgetState((current) => {
        if (current.timer.status !== 'running' || current.timer.deadline !== deadline) return current
        return {
          ...current,
          timer: {
            status: remainingMs === 0 ? 'completed' : 'running',
            remainingMs,
            deadline,
          },
        }
      })
    }, 50)
    return () => window.clearInterval(interval)
  }, [timerWidgetState.timer.status, timerWidgetState.timer.deadline])

  useEffect(() => {
    if (!timerWidgetState.stopwatch.running || timerWidgetState.stopwatch.startedAt === null) return
    const startedAt = timerWidgetState.stopwatch.startedAt
    const interval = window.setInterval(() => {
      setTimerWidgetState((current) => {
        if (!current.stopwatch.running || current.stopwatch.startedAt !== startedAt) return current
        return { ...current, stopwatch: { ...current.stopwatch, elapsedMs: Math.max(0, Date.now() - startedAt) } }
      })
    }, 50)
    return () => window.clearInterval(interval)
  }, [timerWidgetState.stopwatch.running, timerWidgetState.stopwatch.startedAt])

  useEffect(() => {
    const timer = timerWidgetState.timer.status === 'running'
      ? { ...timerWidgetState.timer, remainingMs: 0 }
      : timerWidgetState.timer
    const stopwatch = timerWidgetState.stopwatch.running
      ? { ...timerWidgetState.stopwatch, elapsedMs: 0 }
      : timerWidgetState.stopwatch
    const state = { timer, stopwatch }
    const serialized = JSON.stringify(state)
    if (serialized === lastWidgetState.current) return
    lastWidgetState.current = serialized
    window.vcc.updateTimerWidget(state).catch((error: unknown) => {
      lastWidgetState.current = ''
      notifyError(error instanceof Error ? error.message : 'Timer-Fenster konnte nicht aktualisiert werden.')
    })
  }, [timerWidgetState, notifyError])

  useEffect(() => {
    const toggleTimer = () => setTimerWidgetState((current) => {
      if (current.timer.status === 'running' && current.timer.deadline !== null) {
        const remainingMs = Math.max(0, current.timer.deadline - Date.now())
        return {
          ...current,
          timer: {
            status: remainingMs === 0 ? 'completed' : 'paused',
            remainingMs,
            deadline: remainingMs === 0 ? current.timer.deadline : null,
          },
        }
      }
      if (current.timer.status === 'paused' && current.timer.remainingMs > 0) {
        const deadline = Date.now() + current.timer.remainingMs
        return { ...current, timer: { ...current.timer, status: 'running', deadline } }
      }
      return current
    })
    const toggleStopwatch = () => setTimerWidgetState((current) => {
      if (current.stopwatch.running && current.stopwatch.startedAt !== null) {
        return {
          ...current,
          stopwatch: { running: false, elapsedMs: Math.max(0, Date.now() - current.stopwatch.startedAt), startedAt: null },
        }
      }
      const startedAt = Date.now() - current.stopwatch.elapsedMs
      return { ...current, stopwatch: { ...current.stopwatch, running: true, startedAt } }
    })
    const handleAction = (action: TimerWidgetAction) => {
      if (action === 'timer-toggle') toggleTimer()
      if (action === 'timer-reset') setTimerWidgetState((current) => ({ ...current, timer: idleTimerWidgetState.timer }))
      if (action === 'stopwatch-toggle') toggleStopwatch()
      if (action === 'stopwatch-reset') setTimerWidgetState((current) => ({ ...current, stopwatch: idleTimerWidgetState.stopwatch }))
    }
    return window.vcc.onTimerWidgetAction(handleAction)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
    document.documentElement.dataset.animations = String(settings.animations)
    document.documentElement.style.setProperty('--blue', settings.accent)
    document.documentElement.style.setProperty('--user-background', settings.backgroundData ? `url("${settings.backgroundData}")` : 'none')
    document.documentElement.dataset.compactSidebar = String(settings.compactSidebar)
  }, [settings])

  const updateSettings = useCallback(async (patch: Partial<AppSettings>): Promise<boolean> => {
    try {
      const saved = await window.vcc.saveSettings(patch)
      setSettings(saved)
      setToast(null)
      return true
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Einstellung konnte nicht gespeichert werden.')
      return false
    }
  }, [notifyError])

  const selectPage = (nextPage: string) => {
    setPage(nextPage)
    setToast(null)
  }

  const downloadUpdate = async () => {
    if (checkingUpdates || installingUpdate) return
    setInstallingUpdate(true)
    setToast({ message: 'Das neueste Release wird geprüft. Ein verfügbares Update wird direkt installiert.', kind: 'info' })
    try {
      const update = await window.vcc.downloadUpdate()
      if (!update.updateAvailable || !update.latestVersion) {
        setAvailableUpdate(null)
        notifyInfo('VCC ist auf dem neuesten Stand.')
        return
      }

      const tag = update.latestVersion
      setAvailableUpdate({ tag, hasInstaller: Boolean(update.downloadUrl) })
      if (!update.downloadUrl) {
        await window.vcc.openRelease(tag)
        notifyInfo(`Version ${tag} ist verfügbar. Die Release-Seite wurde geöffnet.`)
      }
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Update konnte nicht installiert werden.')
    } finally {
      setInstallingUpdate(false)
    }
  }

  const controlWindow = (action: 'minimizeWindow' | 'toggleMaximizeWindow' | 'closeWindow') => {
    window.vcc[action]().catch((error: unknown) => {
      notifyError(error instanceof Error ? error.message : 'Fensteraktion konnte nicht ausgeführt werden.')
    })
  }

  let pageContent
  switch (page) {
    case 'Dashboard':
      pageContent = <DashboardPage onNavigate={selectPage} />
      break
    case 'System Monitor':
      pageContent = <SystemMonitorPage notifyError={notifyError} />
      break
    case 'Spielebibliothek':
      pageContent = <LibraryPage notifyError={notifyError} />
      break
    case 'Performance':
      pageContent = <PerformancePage notifyError={notifyError} />
      break
    case 'Network Center':
      pageContent = <NetworkPage notifyError={notifyError} />
      break
    case 'Gaming Tools':
      pageContent = <ToolsPage
        notifyError={notifyError}
        onNavigate={selectPage}
        timer={timerWidgetState.timer}
        stopwatch={timerWidgetState.stopwatch}
        onTimerChange={(timer) => setTimerWidgetState((current) => ({ ...current, timer }))}
        onStopwatchChange={(stopwatch) => setTimerWidgetState((current) => ({ ...current, stopwatch }))}
      />
      break
    case 'Vexlor Arcade':
      pageContent = <ArcadePage />
      break
    case 'Screenshot Tool':
      pageContent = <ScreenshotPage initialImage={hotkeyScreenshot} notifyError={notifyError} notifyInfo={notifyInfo} />
      break
    case 'Anpassung':
      pageContent = <CustomizationPage settings={settings} updateSettings={updateSettings} notifyError={notifyError} notifyInfo={notifyInfo} onNavigate={selectPage} />
      break
    case 'Einstellungen':
      pageContent = <SettingsPage settings={settings} updateSettings={updateSettings} notifyError={notifyError} notifyInfo={notifyInfo} onNavigate={selectPage} onUpdateChecked={(update) => setAvailableUpdate(update.updateAvailable && update.latestVersion ? { tag: update.latestVersion, hasInstaller: Boolean(update.downloadUrl) } : null)} />
      break
    case 'Über Vexlor':
      pageContent = <AboutPage onNavigate={selectPage} />
      break
    case 'Impressum':
    case 'Datenschutzerklärung':
    case 'Nutzungsbedingungen':
      pageContent = <LegalPage page={page} />
      break
    default:
      pageContent = <DashboardPage onNavigate={selectPage} />
  }

  return <div className="app-shell">
    <Sidebar activeItem={page} compact={settings.compactSidebar} onSelect={selectPage} />
    <main className="main-content">
      <header className="topbar">
        <div className="breadcrumb"><span>VEXLOR</span><b>/</b><strong>{page}</strong></div>
        <div className="topbar-right">{availableUpdate
          ? <button className="topbar-update-button" disabled={installingUpdate || checkingUpdates} onClick={() => void downloadUpdate()} aria-live="polite"><Icon name="refresh" /> {installingUpdate ? 'Prüfe & installiere …' : availableUpdate.hasInstaller ? 'Update installieren' : 'Release ansehen'} <span>{availableUpdate.tag}</span></button>
          : <button className="topbar-update-button update-check-button" disabled={checkingUpdates || installingUpdate} onClick={() => void downloadUpdate()}><Icon name="refresh" /> {checkingUpdates ? 'Prüfe Updates …' : installingUpdate ? 'Update wird installiert …' : 'Updates suchen & installieren'}</button>}
          <div className="live-indicator"><span /> LOKAL AKTIV</div><span className="topbar-divider" /><span className="topbar-version">VCC <b>{packageJson.version}</b></span></div>
        <div className="window-controls" aria-label="Fenstersteuerung">
          <button onClick={() => controlWindow('minimizeWindow')} aria-label="Minimieren" title="Minimieren"><Icon name="minimize" /></button>
          <button onClick={() => controlWindow('toggleMaximizeWindow')} aria-label="Maximieren oder wiederherstellen" title="Maximieren oder wiederherstellen"><Icon name="maximize" /></button>
          <button className="window-close" onClick={() => controlWindow('closeWindow')} aria-label="Schließen" title="Schließen"><Icon name="close" /></button>
        </div>
      </header>
      <div className="page-scroll" key={page}>{pageContent}<footer className="page-footer"><span>VEXLOR CONTROL CENTER</span><span>LOKAL. TRANSPARENT. DEIN PC.</span></footer></div>
    </main>
    {toast && <div className={`app-toast ${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}><span>{toast.kind === 'error' ? '!' : '✓'}</span><p>{toast.message}</p><button onClick={() => setToast(null)} aria-label="Meldung schließen"><Icon name="arrow" /></button></div>}
  </div>
}
