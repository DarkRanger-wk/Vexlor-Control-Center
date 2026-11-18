import { useEffect, useState } from 'react'
import packageJson from '../../package.json'
import type { AppSettings, ArcadeProfile, GameEntry, SystemSnapshot } from '../types/app'
import { formatBytes, formatPercent } from '../services/format'
import { Icon } from '../components/Icon'

interface DashboardPageProps {
  onNavigate: (page: string) => void
  settings: AppSettings
  updateSettings: (settings: Partial<AppSettings>) => Promise<boolean>
}

export function DashboardPage({ onNavigate, settings, updateSettings }: DashboardPageProps) {
  const [snapshot, setSnapshot] = useState<SystemSnapshot | null>(null)
  const [games, setGames] = useState<GameEntry[]>([])
  const [arcade, setArcade] = useState<ArcadeProfile | null>(null)
  const [now, setNow] = useState(new Date())
  const [error, setError] = useState('')
  const [customize, setCustomize] = useState(false)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const [system, library, arcadeProfile] = await Promise.all([
          window.vcc.getSystemSnapshot(),
          window.vcc.listGames(),
          window.vcc.getArcadeProfile(),
        ])
        if (active) {
          setSnapshot(system)
          setGames(library)
          setArcade(arcadeProfile)
          setError('')
        }
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'Systemdaten konnten nicht geladen werden.')
      }
    }
    void load()
    const poll = window.setInterval(() => void load(), 3000)
    const clock = window.setInterval(() => setNow(new Date()), 1000)
    return () => {
      active = false
      window.clearInterval(poll)
      window.clearInterval(clock)
    }
  }, [])

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const date = new Intl.DateTimeFormat('de-DE', { timeZone, weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(now)
  const clockParts = new Intl.DateTimeFormat('de-DE', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const hours = clockParts.find((part) => part.type === 'hour')?.value
  const minutes = clockParts.find((part) => part.type === 'minute')?.value
  const seconds = clockParts.find((part) => part.type === 'second')?.value
  const recent = games.filter((game) => game.lastLaunchedAt).sort((a, b) => Date.parse(b.lastLaunchedAt!) - Date.parse(a.lastLaunchedAt!)).slice(0, 3)

  return (
    <>
      <section className="welcome-row">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> DEIN GAMING HUB</div>
          <h1>Alles im <span>Überblick.</span></h1>
          <p className="welcome-subtitle">Dein System. Deine Spiele. Dein Setup.</p>
        </div>
        <div className="date-panel">
          <span className="date-label">{date}</span>
          <time className="clock" dateTime={now.toISOString()}>
            {hours}:{minutes}
            <span>:{seconds}</span>
          </time>
        </div>
      </section>

      <div className="dashboard-customize-bar">
        <span>Dashboard · Schnellübersicht</span>
        <button type="button" onClick={() => setCustomize((current) => !current)} aria-expanded={customize}>
          <Icon name="settings" /> Elemente anpassen
        </button>
      </div>
      {customize && <section className="dashboard-element-panel panel" aria-label="Dashboard-Elemente">
        {([
          ['systemStats', 'Systemstatistiken'],
          ['systemOverview', 'Systemübersicht'],
          ['library', 'Spielebibliothek'],
          ['arcade', 'Arcade-Leiste'],
          ['quickActions', 'Schnellzugriffe'],
        ] as const).map(([key, label]) => <label key={key}>
          <span>{label}</span>
          <input
            type="checkbox"
            checked={settings.dashboardElements[key]}
            onChange={(event) => void updateSettings({
              dashboardElements: { ...settings.dashboardElements, [key]: event.target.checked },
            })}
          />
        </label>)}
      </section>}

      {error && <div className="error-banner" role="alert">{error}</div>}

      {settings.dashboardElements.systemStats && <section className="system-grid" aria-label="Aktuelle Systemauslastung">
        <MetricCard icon="cpu" tag="PROZESSOR" label="CPU-Auslastung" value={formatPercent(snapshot?.cpu.usagePercent ?? null)} detail={snapshot?.cpu.model ?? 'Wird gemessen …'} foot={snapshot ? `${snapshot.cpu.logicalCores} logische Kerne` : 'Erste Messung läuft'} />
        <MetricCard icon="memory" tag="ARBEITSSPEICHER" label="RAM-Auslastung" value={formatPercent(snapshot?.memory.usagePercent ?? null)} detail={snapshot ? `${formatBytes(snapshot.memory.usedBytes)} von ${formatBytes(snapshot.memory.totalBytes)} belegt` : 'Wird gemessen …'} foot="Physischer Arbeitsspeicher" />
        <MetricCard icon="monitor" tag="GRAFIKKARTE" label="GPU" value={snapshot?.gpus.length ? snapshot.gpus[0] : 'Nicht verfügbar'} detail={snapshot?.gpus.length ? 'GPU-Auslastung wird nicht vom System gemeldet.' : 'Keine GPU-Information erkannt'} foot="Keine geschätzten Werte" />
      </section>}

      <section className="content-grid dashboard-details">
        {settings.dashboardElements.systemOverview && <article className="panel system-panel">
          <div className="panel-heading"><div><div className="section-kicker">DEIN SETUP</div><h2>Systemübersicht</h2></div><span className="panel-status"><i /> LOKAL</span></div>
          <div className="system-info-list">
            <InfoRow icon="windows" title="Betriebssystem" value={snapshot ? `${snapshot.operatingSystem.name} ${snapshot.operatingSystem.version}` : 'Wird geladen …'} trailing={snapshot?.operatingSystem.architecture ?? '—'} />
            <InfoRow icon="cpu" title="Prozessor" value={snapshot?.cpu.model ?? 'Wird geladen …'} trailing={snapshot ? `${snapshot.cpu.logicalCores} Threads` : '—'} />
            <InfoRow icon="memory" title="Arbeitsspeicher" value={snapshot ? formatBytes(snapshot.memory.totalBytes) : 'Wird geladen …'} trailing="Gesamt" />
          </div>
          <div className="snapshot-foot"><span>Lokale Messung · Aktualisierung alle 3 Sekunden</span><span>{snapshot ? `Letzte Messung ${new Date(snapshot.sampledAt).toLocaleTimeString('de-DE')}` : 'Noch keine Messung'}</span></div>
        </article>}

        {settings.dashboardElements.library && <article className="panel library-panel">
          <div className="panel-heading"><div><div className="section-kicker">DEINE SAMMLUNG</div><h2>Spielebibliothek <span className="count-pill">{games.length}</span></h2></div><button className="text-button" onClick={() => onNavigate('Spielebibliothek')}>Öffnen <Icon name="arrow" /></button></div>
          {recent.length > 0 ? <div className="recent-list">{recent.map((game) => <div className="recent-game" key={game.id}>{game.coverData ? <img src={game.coverData} alt="" /> : <div className="game-cover-fallback"><Icon name="library" /></div>}<div><strong>{game.name}</strong><small>Zuletzt gestartet · {new Date(game.lastLaunchedAt!).toLocaleDateString('de-DE')}</small></div><span className="recent-category">{game.category}</span></div>)}</div> : <div className="empty-library"><div className="empty-art"><span className="empty-art-ring" /><Icon name="library" /><span className="empty-art-plus">+</span></div><strong>Dein nächstes Abenteuer wartet.</strong><p>Füge deine Spiele hinzu und starte sie direkt aus deiner lokalen Bibliothek.</p><button className="primary-button small-button" onClick={() => onNavigate('Spielebibliothek')}>Bibliothek öffnen</button></div>}
          <div className="library-footer"><span><i /> Lokal auf diesem PC gespeichert</span><span className="phase-label">{games.length} SPIELE</span></div>
        </article>}
      </section>

      {settings.dashboardElements.arcade && <section className="dashboard-app-stats">
        <article className="panel"><span className="section-kicker">GAMING-PROFIL</span><strong>{settings.gamingProfileName}</strong><small>{arcade ? `${arcade.roundsPlayed} Arcade-Runden gespielt` : 'Arcade-Daten werden geladen …'}</small></article>
        <article className="panel"><span className="section-kicker">ARCADE-REKORD</span><strong>{arcade ? arcade.highScore.toLocaleString('de-DE') : '—'} Punkte</strong><small>{arcade ? `${arcade.achievements.length} Erfolge freigeschaltet` : 'Wird geladen …'}</small></article>
        <article className="panel"><span className="section-kicker">LETZTE AKTIVITÄT</span><strong>{recent[0]?.name ?? 'Noch keine Aktivität'}</strong><small>{recent[0]?.lastLaunchedAt ? new Date(recent[0].lastLaunchedAt).toLocaleString('de-DE') : 'Spiele starten, um die Liste zu füllen'}</small></article>
      </section>}

      {settings.dashboardElements.quickActions && <section className="quick-actions">
        <button onClick={() => onNavigate('System Monitor')}><Icon name="monitor" /><span>Systemdetails</span><Icon className="quick-arrow" name="arrow" /></button>
        <button onClick={() => onNavigate('Performance')}><Icon name="performance" /><span>Performance</span><Icon className="quick-arrow" name="arrow" /></button>
        <button onClick={() => onNavigate('Gaming Tools')}><Icon name="tools" /><span>Gaming Tools</span><Icon className="quick-arrow" name="arrow" /></button>
        <button onClick={() => onNavigate('Vexlor Arcade')}><Icon name="arcade" /><span>Vexlor Arcade</span><Icon className="quick-arrow" name="arrow" /></button>
      </section>}
      <div className="bottom-strip"><div className="strip-icon"><Icon name="spark" /></div><div className="strip-copy"><strong>Vexlor Control Center <span>· Dein Setup im Fokus.</span></strong><small>Systemwerte werden lokal ermittelt. Es werden keine Leistungswerte geschätzt.</small></div><div className="strip-app-version"><span>APP VERSION</span><strong>{snapshot?.appVersion ?? packageJson.version}</strong></div></div>
    </>
  )
}

function MetricCard({ icon, tag, label, value, detail, foot }: { icon: 'cpu' | 'memory' | 'monitor'; tag: string; label: string; value: string; detail: string; foot: string }) {
  const isPercent = value.endsWith('%')
  const progress = isPercent ? Number.parseInt(value, 10) : 0
  return <article className={`metric-card ${icon}-card`}><div className="metric-top"><div className={`metric-icon ${icon}-icon`}><Icon name={icon} /></div><span className="metric-tag">{tag}</span><span className="metric-live"><i /> LIVE</span></div><div className="metric-label">{label}</div><div className={`metric-value${isPercent ? '' : ' unavailable'}`}>{value}</div><div className="metric-progress"><span style={{ width: `${progress}%` }} /></div><div className="metric-detail">{detail}</div><div className="metric-foot">{foot}</div></article>
}

export function InfoRow({ icon, title, value, trailing }: { icon: 'windows' | 'cpu' | 'memory'; title: string; value: string; trailing: string }) {
  return <div className="system-info-row"><span className={`info-icon info-${icon}`}><Icon name={icon} /></span><div className="info-copy"><span>{title}</span><strong>{value}</strong></div><span className="info-trailing">{trailing}</span></div>
}
