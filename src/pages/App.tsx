import { useCallback, useEffect, useRef, useState } from 'react'
import packageJson from '../../package.json'
import { Icon } from '../components/Icon'
import { Sidebar } from '../components/Sidebar'
import type { AppSettings } from '../types/app'
import { DashboardPage } from './DashboardPage'
import { LibraryPage } from './LibraryPage'
import { NetworkPage, PerformancePage, SystemMonitorPage } from './SystemPages'
import { AboutPage, CustomizationPage, LegalPage, SettingsPage } from './SettingsPage'
import { ToolsPage } from './ToolsPage'

const defaultSettings: AppSettings = {
  accent: '#428bff',
  theme: 'navy',
  animations: true,
  compactSidebar: false,
  backgroundData: null,
  notifications: true,
  launchAtLogin: false,
  githubRepository: '',
  autoCheckUpdates: true,
}

export default function App() {
  const [page, setPage] = useState('Dashboard')
  const [settings, setSettings] = useState(defaultSettings)
  const [availableUpdate, setAvailableUpdate] = useState<{ repository: string; tag: string; hasInstaller: boolean } | null>(null)
  const [installingUpdate, setInstallingUpdate] = useState(false)
  const [checkingUpdates, setCheckingUpdates] = useState(false)
  const [toast, setToast] = useState<{ message: string; kind: 'error' | 'info' } | null>(null)
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
    if (!settings.autoCheckUpdates || !settings.githubRepository) return
    let active = true
    const checkForUpdates = async () => {
      if (active) setCheckingUpdates(true)
      try {
        const update = await window.vcc.checkUpdates(settings.githubRepository)
        if (!active) return
        if (update.updateAvailable && update.latestVersion) {
          setAvailableUpdate({ repository: settings.githubRepository, tag: update.latestVersion, hasInstaller: Boolean(update.downloadUrl) })
          if (settings.notifications && notifiedUpdateTag.current !== update.latestVersion) {
            notifiedUpdateTag.current = update.latestVersion
            notifyInfo(`Version ${update.latestVersion} ist verfügbar und kann oben rechts installiert werden.`)
          }
        } else {
          setAvailableUpdate(null)
        }
      } catch (error) {
        if (active) notifyError(error instanceof Error ? error.message : 'Automatische Updateprüfung fehlgeschlagen.')
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
  }, [settings.autoCheckUpdates, settings.githubRepository, settings.notifications, notifyError, notifyInfo])

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
      if (patch.githubRepository !== undefined) setAvailableUpdate(null)
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
    if (!availableUpdate) return
    if (!availableUpdate.hasInstaller) {
      try {
        await window.vcc.openRelease(availableUpdate.repository, availableUpdate.tag)
      } catch (error) {
        notifyError(error instanceof Error ? error.message : 'Release konnte nicht geöffnet werden.')
      }
      return
    }

    setInstallingUpdate(true)
    setToast({ message: `Version ${availableUpdate.tag} wird heruntergeladen und installiert. Deine lokalen Daten bleiben erhalten.`, kind: 'info' })
    try {
      await window.vcc.downloadUpdate(availableUpdate.repository, availableUpdate.tag)
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

  const checkForUpdates = async () => {
    if (checkingUpdates) return
    const repository = settings.githubRepository.trim()
    if (!repository) {
      setPage('Einstellungen')
      setToast({ message: 'Hinterlege zuerst dein GitHub-Repository unter Einstellungen → Updates.', kind: 'info' })
      return
    }

    setCheckingUpdates(true)
    try {
      const update = await window.vcc.checkUpdates(repository)
      if (update.updateAvailable && update.latestVersion) {
        setAvailableUpdate({ repository, tag: update.latestVersion, hasInstaller: Boolean(update.downloadUrl) })
        notifyInfo(update.downloadUrl
          ? `Version ${update.latestVersion} ist verfügbar und kann oben installiert werden.`
          : `Version ${update.latestVersion} ist verfügbar. Der Release enthält keinen Installer.`)
      } else {
        setAvailableUpdate(null)
        notifyInfo('VCC ist auf dem neuesten Stand.')
      }
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Updateprüfung fehlgeschlagen.')
    } finally {
      setCheckingUpdates(false)
    }
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
      pageContent = <ToolsPage notifyError={notifyError} onNavigate={selectPage} />
      break
    case 'Anpassung':
      pageContent = <CustomizationPage settings={settings} updateSettings={updateSettings} notifyError={notifyError} notifyInfo={notifyInfo} onNavigate={selectPage} />
      break
    case 'Einstellungen':
      pageContent = <SettingsPage settings={settings} updateSettings={updateSettings} notifyError={notifyError} notifyInfo={notifyInfo} onNavigate={selectPage} onUpdateChecked={(update, repository) => setAvailableUpdate(update.updateAvailable && update.latestVersion ? { repository, tag: update.latestVersion, hasInstaller: Boolean(update.downloadUrl) } : null)} />
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
          ? <button className="topbar-update-button" disabled={installingUpdate} onClick={() => void downloadUpdate()} aria-live="polite"><Icon name="refresh" /> {installingUpdate ? 'Update wird installiert …' : availableUpdate.hasInstaller ? 'Update installieren' : 'Release ansehen'} <span>{availableUpdate.tag}</span></button>
          : <button className="topbar-update-button update-check-button" disabled={checkingUpdates} onClick={() => void checkForUpdates()}><Icon name="refresh" /> {checkingUpdates ? 'Suche Updates …' : 'Updates suchen'}</button>}
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
