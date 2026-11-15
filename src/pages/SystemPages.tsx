import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { formatBytes, formatPercent, formatRate } from '../services/format'
import type { NetworkSnapshot, ProcessEntry, SystemSnapshot } from '../types/app'
import { InfoRow } from './DashboardPage'
import { PageIntro } from './LibraryPage'

interface PageProps {
  notifyError: (message: string) => void
}

export function SystemMonitorPage({ notifyError }: PageProps) {
  const [snapshot, setSnapshot] = useState<SystemSnapshot | null>(null)

  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        const result = await window.vcc.getSystemSnapshot()
        if (active) setSnapshot(result)
      } catch (error) {
        if (active) notifyError(error instanceof Error ? error.message : 'Systeminformationen konnten nicht gelesen werden.')
      }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 3000)
    return () => { active = false; window.clearInterval(timer) }
  }, [notifyError])

  return <>
    <PageIntro eyebrow="SYSTEMSTATUS" title="System Monitor" description="Aktuelle Hardware- und Betriebssystemdaten dieses PCs." />
    <section className="system-grid monitor-metrics">
      <MonitorMetric icon="cpu" label="CPU-Auslastung" value={formatPercent(snapshot?.cpu.usagePercent ?? null)} detail={snapshot?.cpu.model ?? 'Wird ermittelt …'} />
      <MonitorMetric icon="memory" label="RAM belegt" value={snapshot ? `${formatBytes(snapshot.memory.usedBytes)} / ${formatBytes(snapshot.memory.totalBytes)}` : '—'} detail={`${formatPercent(snapshot?.memory.usagePercent ?? null)} verwendet`} />
      <MonitorMetric icon="windows" label="Betriebssystem" value={snapshot?.operatingSystem.name ?? '—'} detail={snapshot ? `${snapshot.operatingSystem.version} · ${snapshot.operatingSystem.architecture}` : 'Wird ermittelt …'} />
    </section>
    <section className="panel detail-panel">
      <div className="panel-heading"><div><div className="section-kicker">ERKANNTE HARDWARE</div><h2>Systemdetails</h2></div><span className="refresh-caption">LIVE · 3 SEK.</span></div>
      <div className="system-info-list">
        <InfoRow icon="cpu" title="Prozessor" value={snapshot?.cpu.model ?? 'Wird geladen …'} trailing={snapshot ? `${snapshot.cpu.logicalCores} logische Kerne` : '—'} />
        <InfoRow icon="memory" title="Arbeitsspeicher" value={snapshot ? `${formatBytes(snapshot.memory.usedBytes)} verwendet` : 'Wird geladen …'} trailing={snapshot ? `${formatBytes(snapshot.memory.totalBytes)} gesamt` : '—'} />
        <InfoRow icon="windows" title="Grafikadapter" value={snapshot?.gpus.length ? snapshot.gpus.join(', ') : 'Nicht verfügbar'} trailing={snapshot?.gpus.length ? `${snapshot.gpus.length} erkannt` : 'Keine Daten'} />
      </div>
      <div className="disk-section"><div className="section-kicker">FESTPLATTEN</div>
        {snapshot?.disks.length ? snapshot.disks.map((disk) => {
          const used = disk.totalBytes - disk.freeBytes
          const percent = disk.totalBytes ? Math.round((used / disk.totalBytes) * 100) : 0
          return <div className="disk-row" key={disk.mount}><div className="disk-title"><strong>{disk.mount}</strong><span>{formatBytes(used)} belegt von {formatBytes(disk.totalBytes)}</span><b>{percent} %</b></div><div className="metric-progress"><span style={{ width: `${percent}%` }} /></div></div>
        }) : <p className="muted-copy">{snapshot ? 'Keine lokalen Festplatten gemeldet.' : 'Festplatten werden ermittelt …'}</p>}
      </div>
      <div className="unavailable-note"><span className="availability-dot" /> Temperaturmessungen werden nicht angezeigt, da keine zuverlässige Sensorquelle integriert ist.</div>
    </section>
  </>
}

export function PerformancePage({ notifyError }: PageProps) {
  const [snapshot, setSnapshot] = useState<SystemSnapshot | null>(null)
  const [processes, setProcesses] = useState<ProcessEntry[]>([])
  const [sort, setSort] = useState<'cpu' | 'memory'>('cpu')
  const [now, setNow] = useState(0)

  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        const [system, processList] = await Promise.all([window.vcc.getSystemSnapshot(), window.vcc.listProcesses()])
        if (active) {
          setSnapshot(system)
          setProcesses(processList)
          setNow(Date.now())
        }
      } catch (error) {
        if (active) notifyError(error instanceof Error ? error.message : 'Performance-Daten konnten nicht gelesen werden.')
      }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 3000)
    return () => { active = false; window.clearInterval(timer) }
  }, [notifyError])

  const sortedProcesses = useMemo(() => [...processes].sort((a, b) => sort === 'cpu'
    ? (b.cpuPercent ?? -1) - (a.cpuPercent ?? -1)
    : b.memoryBytes - a.memoryBytes).slice(0, 40), [processes, sort])
  const highMemory = snapshot?.memory.usagePercent !== null && (snapshot?.memory.usagePercent ?? 0) >= 85
  const highCpu = (snapshot?.cpu.usagePercent ?? 0) >= 85

  return <>
    <PageIntro eyebrow="RESSOURCEN" title="Performance Center" description="Echtzeitübersicht laufender Prozesse. VCC beendet keine Windows- oder Benutzerprozesse." />
    <section className="system-grid monitor-metrics">
      <MonitorMetric icon="cpu" label="CPU-Auslastung" value={formatPercent(snapshot?.cpu.usagePercent ?? null)} detail="Gesamtes System" />
      <MonitorMetric icon="memory" label="RAM-Auslastung" value={formatPercent(snapshot?.memory.usagePercent ?? null)} detail={snapshot ? `${formatBytes(snapshot.memory.usedBytes)} von ${formatBytes(snapshot.memory.totalBytes)}` : 'Wird gemessen …'} />
      <MonitorMetric icon="performance" label="Prozesse" value={processes.length.toLocaleString('de-DE')} detail="Aktuell laufende Einträge" />
    </section>
    <section className="panel process-panel">
      <div className="panel-heading"><div><div className="section-kicker">RESSOURCENVERBRAUCH</div><h2>Hintergrundprozesse</h2></div><select aria-label="Prozesse sortieren" value={sort} onChange={(event) => setSort(event.target.value as 'cpu' | 'memory')}><option value="cpu">Nach CPU</option><option value="memory">Nach Arbeitsspeicher</option></select></div>
      <div className="process-table-wrap"><table className="process-table"><thead><tr><th>PROZESS</th><th>PID</th><th>CPU</th><th>ARBEITSSPEICHER</th></tr></thead><tbody>{sortedProcesses.map((process) => <tr key={process.pid}><td><span className="process-dot" />{process.name}</td><td>{process.pid}</td><td>{process.cpuPercent === null ? 'Messung läuft …' : `${process.cpuPercent.toFixed(1)} %`}</td><td>{formatBytes(process.memoryBytes)}</td></tr>)}</tbody></table>
      {!processes.length && <p className="muted-copy">Prozessliste wird geladen …</p>}</div>
      <div className="panel-footnote">CPU-Werte werden zwischen Messungen berechnet. Prozessdaten werden ausschließlich lokal angezeigt. Aktualisiert {now ? `um ${new Date(now).toLocaleTimeString('de-DE')}` : '…'}.</div>
    </section>
    <section className="panel recommendation-panel"><div className="section-kicker">SICHERE HINWEISE</div><h2>Leistung bewusst verbessern</h2><div className="recommendation-list">
      {highMemory && <Recommendation>Der Arbeitsspeicher ist aktuell stark belegt. Prüfe die Prozessliste und schließe nicht benötigte Anwendungen selbst, nachdem du deine Arbeit gespeichert hast.</Recommendation>}
      {highCpu && <Recommendation>Die CPU ist aktuell stark ausgelastet. Warte kurz oder prüfe die Prozessliste, bevor du ein Spiel startest.</Recommendation>}
      {!highMemory && !highCpu && <Recommendation>Prüfe bei Bedarf Autostart-Apps in den Windows-Einstellungen. VCC ändert keine Registry-Einträge und beendet keine Prozesse.</Recommendation>}
      <Recommendation>Ein Neustart des PCs kann temporäre Auslastung reduzieren. Speichere vorher offene Arbeit.</Recommendation>
    </div></section>
  </>
}

export function NetworkPage({ notifyError }: PageProps) {
  const [snapshot, setSnapshot] = useState<NetworkSnapshot | null>(null)
  const [history, setHistory] = useState<number[]>([])
  const [failure, setFailure] = useState('')

  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        const result = await window.vcc.getNetworkSnapshot()
        if (active) {
          setSnapshot(result)
          setFailure('')
          const activity = (result.downloadBytesPerSecond ?? 0) + (result.uploadBytesPerSecond ?? 0)
          setHistory((values) => [...values.slice(-23), activity])
        }
      } catch (error) {
        if (active) {
          const message = error instanceof Error ? error.message : 'Netzwerkdaten konnten nicht gelesen werden.'
          setFailure(message)
          notifyError(message)
        }
      }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 3000)
    return () => { active = false; window.clearInterval(timer) }
  }, [notifyError])

  const maxActivity = Math.max(...history, 1)
  return <>
    <PageIntro eyebrow="VERBINDUNGSSTATUS" title="Network Center" description="Lokale Netzwerkadapter und gemessene Datenübertragung dieses PCs." />
    <section className="network-summary panel">
      <div className="network-state-mark"><Icon name="network" /></div>
      <div className="network-state-copy"><span className="section-kicker">VERBINDUNG</span><h2>{snapshot?.connected ? 'Verbunden' : 'Keine aktive Verbindung'}</h2><p>{snapshot?.adapterName ?? (failure || 'Adapterstatus wird geprüft …')}</p></div>
      <span className={`connection-pill${snapshot?.connected ? ' connected' : ''}`}><i />{snapshot?.connected ? 'ONLINE' : 'OFFLINE'}</span>
    </section>
    <section className="network-metrics">
      <NetworkMetric label="Verbindungstyp" value={snapshot?.connectionType ?? 'Nicht verfügbar'} icon="network" />
      <NetworkMetric label="Download" value={formatRate(snapshot?.downloadBytesPerSecond ?? null)} icon="arrow" />
      <NetworkMetric label="Upload" value={formatRate(snapshot?.uploadBytesPerSecond ?? null)} icon="arrow" />
    </section>
    <section className="panel network-activity-panel"><div className="panel-heading"><div><div className="section-kicker">LIVE-MESSUNG</div><h2>Netzwerkaktivität</h2></div><span className="refresh-caption">3 SEK. INTERVALL</span></div><div className="activity-chart" role="img" aria-label="Gemessene Netzwerkaktivität in den letzten Intervallen">{history.map((value, index) => <span key={index} style={{ height: `${Math.max(3, (value / maxActivity) * 100)}%` }} />)}</div><div className="chart-caption"><span>Älteste Messung</span><span>{formatRate((snapshot?.downloadBytesPerSecond ?? 0) + (snapshot?.uploadBytesPerSecond ?? 0))}</span><span>Neueste Messung</span></div>
      <div className="local-addresses"><span className="section-kicker">LOKALE IPv4-ADRESSEN</span>{snapshot?.localAddresses.length ? snapshot.localAddresses.map((address) => <code key={address}>{address}</code>) : <span className="muted-copy">Keine lokale IPv4-Adresse verfügbar.</span>}</div>
      <div className="panel-footnote">Übertragungsraten basieren auf Adapterzählern von Windows. Es wird kein externer Geschwindigkeitstest ausgeführt.</div></section>
  </>
}

function MonitorMetric({ icon, label, value, detail }: { icon: 'cpu' | 'memory' | 'windows' | 'performance'; label: string; value: string; detail: string }) {
  return <article className="metric-card monitor-card"><div className="metric-top"><div className="metric-icon"><Icon name={icon} /></div><span className="metric-tag">SYSTEM</span></div><div className="metric-label">{label}</div><div className="metric-value monitor-value">{value}</div><div className="metric-detail">{detail}</div><div className="metric-foot">Lokale Systemdaten</div></article>
}

function NetworkMetric({ label, value, icon }: { label: string; value: string; icon: 'network' | 'arrow' }) {
  return <article className="network-metric panel"><span className="network-metric-icon"><Icon name={icon} /></span><span>{label}</span><strong>{value}</strong></article>
}

function Recommendation({ children }: { children: string }) {
  return <div className="recommendation"><span><Icon name="spark" /></span><p>{children}</p></div>
}
