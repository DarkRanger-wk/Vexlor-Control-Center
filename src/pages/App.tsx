import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import packageJson from '../../package.json'
import { Icon } from '../components/Icon'
import { Sidebar } from '../components/Sidebar'
import { createDefaultCustomization } from '../services/customization.mjs'
import type { AppSettings, TimerWidgetAction, TimerWidgetState } from '../types/app'
import { DashboardPage } from './DashboardPage'
import { LibraryPage } from './LibraryPage'
import { NetworkPage, PerformancePage, SystemMonitorPage } from './SystemPages'
import { AboutPage, LegalPage, SettingsPage } from './SettingsPage'
import { ToolsPage } from './ToolsPage'
import { ScreenshotPage } from './ScreenshotPage'
import ArcadePage from './ArcadePage.jsx'
import CustomizationPage from './CustomizationPage.jsx'
import AdminPage from './AdminPage.jsx'
import RedeemCodePage from './RedeemCodePage.jsx'
import SupportPage from './SupportPage.jsx'

const defaultSettings: AppSettings = {
  username: '',
  accent: '#428bff',
  theme: 'navy',
  animations: true,
  compactSidebar: false,
  backgroundData: null,
  customization: createDefaultCustomization(),
  notifications: true,
  launchAtLogin: false,
  autoCheckUpdates: true,
  telemetryEnabled: false,
  screenshotShortcut: 'Ctrl+Shift+S',
  gamingProfileName: 'Lokales Gaming-Profil',
  gameSoundEnabled: true,
  gameSoundVolume: 0.35,
  dashboardElements: {
    systemStats: true,
    systemOverview: true,
    library: true,
    arcade: true,
    quickActions: true,
  },
}

const idleTimerWidgetState: TimerWidgetState = {
  timer: { status: 'idle', remainingMs: 0, deadline: null },
  stopwatch: { running: false, elapsedMs: 0, startedAt: null },
}

export default function App() {
  const [page, setPage] = useState('Dashboard')
  const [settings, setSettings] = useState(defaultSettings)
  const [supportUnreadCount, setSupportUnreadCount] = useState(0)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [usernamePromptDismissed, setUsernamePromptDismissed] = useState(false)
  const [usernameDraft, setUsernameDraft] = useState('')
  const [savingUsername, setSavingUsername] = useState(false)
  const [availableUpdate, setAvailableUpdate] = useState<{ tag: string; hasInstaller: boolean } | null>(null)
  const [installingUpdate, setInstallingUpdate] = useState(false)
  const [checkingUpdates, setCheckingUpdates] = useState(false)
  const [toast, setToast] = useState<{ message: string; kind: 'error' | 'info' } | null>(null)
  const [hotkeyScreenshot, setHotkeyScreenshot] = useState<string | null>(null)
  const [timerWidgetState, setTimerWidgetState] = useState(idleTimerWidgetState)
  const settingsRef = useRef(defaultSettings)
  const customizationSaveTimeout = useRef<number | null>(null)
  const lastWidgetState = useRef('')
  const notifiedUpdateTag = useRef<string | null>(null)

  const notifyError = useCallback((message: string) => setToast({ message, kind: 'error' }), [])
  const notifyInfo = useCallback((message: string) => setToast({ message, kind: 'info' }), [])

  useEffect(() => {
    let active = true
    window.vcc.getSettings().then((saved) => {
      if (!active) return
      settingsRef.current = saved
      setSettings(saved)
      setSettingsLoaded(true)
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
    if (!settingsLoaded) return
    let active = true
    let previousUnreadCount: number | null = null
    const pollSupport = async () => {
      try {
        if (!await window.vcc.hasTicketIdentity()) return
        const result = await window.vcc.ticketRequest('/api/tickets')
        if (result.status < 200 || result.status >= 300) {
          throw new Error(typeof result.body.error === 'string' ? result.body.error : 'Support-Benachrichtigungen konnten nicht geladen werden.')
        }
        if (!active) return
        const unreadCount = Number(result.body.unreadCount) || 0
        setSupportUnreadCount(unreadCount)
        if (previousUnreadCount !== null && unreadCount > previousUnreadCount) {
          notifyInfo('Dein Ticket hat eine neue Antwort vom Support-Team.')
        }
        previousUnreadCount = unreadCount
      } catch (error) {
        if (active) console.warn('Support-Benachrichtigungen konnten nicht geladen werden:', error)
      }
    }

    void pollSupport()
    const interval = window.setInterval(() => void pollSupport(), 60 * 1000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [settingsLoaded, notifyInfo])

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
    const root = document.documentElement
    const { values } = settings.customization
    const { colors, background, layout } = values
    const backgroundLayer = background.mode === 'gradient'
      ? `linear-gradient(135deg, ${background.gradientStart}, ${background.gradientEnd})`
      : background.mode === 'image' && background.imageData
        ? `url("${background.imageData}")`
        : 'none'

    root.dataset.theme = values.themeId
    root.dataset.animations = String(layout.animations)
    root.dataset.compactSidebar = String(layout.compactSidebar)
    root.dataset.shadows = String(layout.shadows)
    root.dataset.glow = String(layout.glow)
    root.style.setProperty('--bg', colors.background)
    root.style.setProperty('--sidebar', colors.sidebar)
    root.style.setProperty('--panel', colors.card)
    root.style.setProperty('--panel-raised', colors.menu)
    root.style.setProperty('--line', colors.border)
    root.style.setProperty('--text', colors.text)
    root.style.setProperty('--muted', colors.muted)
    root.style.setProperty('--blue', colors.accent)
    root.style.setProperty('--cyan', colors.accent)
    root.style.setProperty('--accent-color', colors.accent)
    root.style.setProperty('--button-color', colors.button)
    root.style.setProperty('--menu-color', colors.menu)
    root.style.setProperty('--card-color', colors.card)
    root.style.setProperty('--border-color', colors.border)
    root.style.setProperty('--muted-color', colors.muted)
    root.style.setProperty('--sidebar-width', `${layout.sidebarWidth}px`)
    root.style.setProperty('--base-font-size', `${layout.fontSize}px`)
    root.style.setProperty('--ui-scale', String(layout.fontSize / 10))
    root.style.setProperty('--font-family-ui', `"${layout.fontFamily}"`)
    root.style.setProperty('--radius-base', `${layout.radius}px`)
    root.style.setProperty('--surface-transparency', `${layout.transparency}%`)
    root.style.setProperty('--animation-speed', String(layout.animationSpeed))
    root.style.setProperty('--background-layer', backgroundLayer)
    root.style.setProperty('--background-color', `color-mix(in srgb, ${colors.background} ${background.opacity}%, #080d18)`)
    root.style.setProperty('--background-blur', `${background.blur}px`)
    root.style.setProperty('--background-opacity', String(background.opacity / 100))
    root.style.setProperty('--surface-shadow', layout.shadows ? '0 18px 48px rgba(0, 0, 0, .2)' : 'none')
    root.style.setProperty('--glow-shadow', layout.glow ? `0 0 18px color-mix(in srgb, ${colors.accent}, transparent 62%)` : 'none')
  }, [settings.customization])

  const updateSettings = useCallback(async (patch: Partial<AppSettings>): Promise<boolean> => {
    if ('customization' in patch) {
      const next = { ...settingsRef.current, ...patch }
      settingsRef.current = next
      setSettings(next)
      setToast(null)
      if (customizationSaveTimeout.current !== null) window.clearTimeout(customizationSaveTimeout.current)
      customizationSaveTimeout.current = window.setTimeout(() => {
        customizationSaveTimeout.current = null
        void window.vcc.saveSettings(patch).then((saved) => {
          settingsRef.current = saved
          setSettings(saved)
        }).catch((error: unknown) => {
          notifyError(error instanceof Error ? error.message : 'Anpassungen konnten nicht gespeichert werden.')
        })
      }, 180)
      return true
    }

    try {
      const saved = await window.vcc.saveSettings(patch)
      settingsRef.current = saved
      setSettings(saved)
      setToast(null)
      return true
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Einstellung konnte nicht gespeichert werden.')
      return false
    }
  }, [notifyError])

  const saveUsername = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const username = usernameDraft.trim()
    if (!username || savingUsername) return

    setSavingUsername(true)
    try {
      if (await updateSettings({ username })) setUsernamePromptDismissed(true)
    } finally {
      setSavingUsername(false)
    }
  }

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
      pageContent = <DashboardPage onNavigate={selectPage} settings={settings} updateSettings={updateSettings} />
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
    case 'Codes einlösen':
      pageContent = <RedeemCodePage />
      break
    case 'Vexlor Arcade':
      pageContent = <ArcadePage
        gameSoundEnabled={settings.gameSoundEnabled}
        gameSoundVolume={settings.gameSoundVolume}
      />
      break
    case 'Screenshot Tool':
      pageContent = <ScreenshotPage initialImage={hotkeyScreenshot} notifyError={notifyError} notifyInfo={notifyInfo} />
      break
    case 'Support & Hilfe':
      pageContent = <SupportPage username={settings.username} notifyInfo={notifyInfo} />
      break
    case 'Customization':
      pageContent = <CustomizationPage settings={settings} updateSettings={updateSettings} notifyError={notifyError} notifyInfo={notifyInfo} />
      break
    case 'Vexlor Admin Panel':
      pageContent = <AdminPage notifyError={notifyError} notifyInfo={notifyInfo} />
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
      pageContent = <DashboardPage onNavigate={selectPage} settings={settings} updateSettings={updateSettings} />
  }

  return <div className="app-shell">
    <Sidebar
      activeItem={page}
      compact={settings.customization.values.layout.compactSidebar}
      username={settings.username}
      supportUnreadCount={supportUnreadCount}
      iconOverrides={settings.customization.values.layout.sidebarIcons}
      onSelect={selectPage}
    />
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
    {settingsLoaded && !settings.username.trim() && !usernamePromptDismissed && <div className="modal-backdrop username-backdrop">
      <section className="username-modal panel" role="dialog" aria-modal="true" aria-labelledby="username-dialog-title">
        <div className="section-kicker">ERSTER START</div>
        <h2 id="username-dialog-title">Willkommen bei Vexlor</h2>
        <p className="username-description">Wie sollen wir dich nennen? Dein Nutzername wird nur auf diesem PC gespeichert und kann später nicht geändert werden.</p>
        <form onSubmit={(event) => void saveUsername(event)}>
          <label className="form-label">Nutzername
            <input
              autoFocus
              autoComplete="nickname"
              maxLength={24}
              value={usernameDraft}
              onChange={(event) => setUsernameDraft(event.target.value)}
              placeholder="z. B. Alex"
              required
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="subtle-button" disabled={savingUsername} onClick={() => setUsernamePromptDismissed(true)}>Später</button>
            <button type="submit" className="primary-button" disabled={!usernameDraft.trim() || savingUsername}>{savingUsername ? 'Wird gespeichert …' : 'Namen speichern'}</button>
          </div>
        </form>
      </section>
    </div>}
    {toast && <div className={`app-toast ${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}><span>{toast.kind === 'error' ? '!' : '✓'}</span><p>{toast.message}</p><button onClick={() => setToast(null)} aria-label="Meldung schließen"><Icon name="arrow" /></button></div>}
  </div>
}
