import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import AdminTicketMailbox from './AdminTicketMailbox.jsx'
import { AnnouncementsSection, CodesSection, RolesSection } from './AdminManagementSections.jsx'
import '../styles/admin.css'

async function adminRequest(path, options = {}) {
  const response = await window.vcc.adminRequest(path, {
    method: options.method ?? 'GET',
    body: options.body,
  })
  const body = response.body
  if (response.status < 200 || response.status >= 300) {
    throw new Error(body.error || 'Die Aktion konnte nicht ausgeführt werden.')
  }
  return body
}

const sections = [
  ['dashboard', 'Admin Dashboard', 'monitor'],
  ['users', 'App-Nutzer', 'library'],
  ['codes', 'Code-Verwaltung', 'screenshot'],
  ['announcements', 'Code-Ankündigungen', 'spark'],
  ['premium', 'Premium-Verwaltung', 'crown'],
  ['app', 'App-Verwaltung', 'settings'],
  ['updates', 'Update-Verwaltung', 'refresh'],
  ['stats', 'Statistik-Zentrale', 'performance'],
  ['support', 'Support-Verwaltung', 'network'],
  ['ticket-mailbox', 'Ticket-Postfach', 'network'],
  ['features', 'Feature-Verwaltung', 'tools'],
  ['roles', 'Rollen und Berechtigungen', 'crown'],
  ['system', 'Systemverwaltung', 'cpu'],
  ['backups', 'Datenbank-Backups', 'save'],
  ['security', 'Sicherheitszentrale', 'target'],
  ['audit', 'Administrator-Protokoll', 'clock'],
]

export default function AdminPage({ notifyError, notifyInfo }) {
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loggingIn, setLoggingIn] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [section, setSection] = useState('dashboard')
  const [dashboard, setDashboard] = useState(null)
  const [users, setUsers] = useState([])
  const [usersTotal, setUsersTotal] = useState(0)
  const [usersPage, setUsersPage] = useState(0)
  const [usersSearch, setUsersSearch] = useState('')
  const [codes, setCodes] = useState([])
  const [support, setSupport] = useState([])

  useEffect(() => {
    let active = true
    adminRequest('/api/admin/auth/me')
      .then((body) => { if (active) setAdmin(body.admin) })
      .catch(() => { if (active) setAdmin(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!admin) return
    let active = true
    let usersRefreshTimer
    setError('')
    if (section === 'dashboard' || section === 'stats') {
      adminRequest('/api/admin/dashboard').then((body) => { if (active) setDashboard(body) }).catch((caught) => { if (active) setError(caught.message) })
    } else if (section === 'users') {
      const loadUsers = () => {
        const params = new URLSearchParams({
          limit: '100',
          offset: String(usersPage * 100),
          search: usersSearch,
        })
        adminRequest(`/api/admin/users?${params}`).then((body) => {
          if (active) {
            setUsers(body.users ?? [])
            setUsersTotal(Number(body.total ?? 0))
          }
        }).catch((caught) => { if (active) setError(caught.message) })
      }
      loadUsers()
      usersRefreshTimer = window.setInterval(loadUsers, 30_000)
    } else if (section === 'codes') {
      adminRequest('/api/admin/codes').then((body) => { if (active) setCodes(body.codes ?? []) }).catch((caught) => { if (active) setError(caught.message) })
    } else if (section === 'support') {
      adminRequest('/api/admin/support').then((body) => { if (active) setSupport(body.requests ?? []) }).catch((caught) => { if (active) setError(caught.message) })
    }
    return () => {
      active = false
      if (usersRefreshTimer) window.clearInterval(usersRefreshTimer)
    }
  }, [admin, section, usersPage, usersSearch])

  const login = async (event) => {
    event.preventDefault()
    setLoggingIn(true)
    setError('')
    try {
      const body = await adminRequest('/api/admin/auth/login', { method: 'POST', body: JSON.stringify({ password }) })
      setAdmin(body.admin)
      setPassword('')
      notifyInfo('Administrator-Anmeldung erfolgreich.')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Anmeldung fehlgeschlagen.'
      setError(message)
      notifyError(message)
    } finally {
      setLoggingIn(false)
    }
  }

  const logout = async () => {
    try {
      await adminRequest('/api/admin/auth/me', { method: 'POST' })
      setAdmin(null)
      notifyInfo('Administrator-Sitzung wurde beendet.')
    } catch (caught) {
      notifyError(caught instanceof Error ? caught.message : 'Abmeldung fehlgeschlagen.')
    }
  }

  if (loading) {
    return <div className="admin-loading" role="status"><span className="admin-spinner" />Administration wird geprüft …</div>
  }

  if (!admin) {
    return <div className="admin-login-shell">
      <section className="admin-login-card panel">
        <div className="admin-login-mark"><Icon name="spark" /></div>
        <div className="section-kicker">GESCHÜTZTER BEREICH</div>
        <h1>Vexlor Admin</h1>
        <p>Administrator-Anmeldung über den geschützten Vexlor-Backend-Dienst.</p>
        <form onSubmit={login}>
          <label htmlFor="admin-password">Administrator-Passwort</label>
          <div className="admin-password-row">
            <input id="admin-password" type={showPassword ? 'text' : 'password'} value={password} minLength={12} maxLength={1024} autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} disabled={loggingIn} />
            <button type="button" aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'} onClick={() => setShowPassword((current) => !current)}><Icon name="eye" /></button>
          </div>
          {error && <div className="admin-error" role="alert">{error}</div>}
          <button className="primary-button" type="submit" disabled={loggingIn || password.length < 12}>{loggingIn ? 'Wird geprüft …' : 'Anmelden'}</button>
        </form>
      </section>
    </div>
  }

  function AdminDashboard({ stats, dashboard }) {
    const cards = [
      ['Registrierte Benutzer', stats?.registeredUsers ?? 0, 'library'],
      ['Aktive Benutzer', stats?.activeUsers ?? 0, 'monitor'],
      ['Premium-Benutzer', stats?.premiumUsers ?? 0, 'crown'],
      ['Erstellte Codes', stats?.createdCodes ?? 0, 'screenshot'],
      ['Aktive Codes', stats?.activeCodes ?? 0, 'spark'],
      ['Eingelöste Codes', stats?.redeemedCodes ?? 0, 'target'],
      ['Installationen', stats?.installations ?? 0, 'windows'],
      ['App-Starts', stats?.appStarts ?? 0, 'launch'],
      ['Downloads', stats?.githubDownloads, 'save'],
    ]
    return <div className="admin-dashboard">
      <div className="admin-stat-grid">{cards.map(([label, value, icon]) => <article className="admin-stat-card panel" key={label}><span><Icon name={icon} /></span><small>{label}</small><strong>{value == null ? '—' : Number(value).toLocaleString('de-DE')}</strong></article>)}</div>
      {dashboard?.downloadsError && <p className="admin-info-message" role="status">{dashboard.downloadsError}</p>}
      <div className="admin-dashboard-grid">
        <section className="panel admin-event-panel"><h2>Letzte Administrator-Aktionen</h2>{dashboard?.recentAudit?.length ? <div className="admin-event-list">{dashboard.recentAudit.map((entry) => <div key={entry.id}><span>{entry.action}</span><small>{new Date(entry.created_at * 1000).toLocaleString('de-DE')}</small><b>{entry.result}</b></div>)}</div> : <p>Keine Administrator-Aktionen vorhanden.</p>}</section>
        <section className="panel admin-event-panel"><h2>Sicherheitsereignisse</h2>{dashboard?.recentSecurityEvents?.length ? <div className="admin-event-list">{dashboard.recentSecurityEvents.map((entry) => <div key={entry.id}><span>{entry.event_type}</span><small>{new Date(entry.created_at * 1000).toLocaleString('de-DE')}</small></div>)}</div> : <p>Keine Sicherheitsereignisse vorhanden.</p>}</section>
      </div>
    </div>
  }

  function UsersSection({ users, total, page, search, onPageChange, onSearchChange, reload }) {
    const act = async (id, action) => {
      if (!window.confirm(action === 'disable' ? 'Benutzerkonto wirklich deaktivieren?' : 'Diese Benutzeraktion ausführen?')) return
      await adminRequest('/api/admin/users', { method: 'POST', body: JSON.stringify({ id, action }) }).then(async () => {
        await reload()
      }).catch((error) => window.alert(error instanceof Error ? error.message : 'Benutzeraktion fehlgeschlagen.'))
    }
    const pageCount = Math.max(1, Math.ceil(total / 100))
    return <div className="admin-table-card panel">
      <div className="admin-table-heading"><h2>App-Nutzer</h2><span>{total} Namen · Online, wenn innerhalb der letzten 2 Minuten gemeldet</span></div>
      <input className="admin-user-search" type="search" value={search} maxLength={100} onChange={(event) => onSearchChange(event.target.value)} placeholder="Nach Namen suchen" aria-label="App-Nutzer nach Namen suchen" />
      {users.length ? <div className="admin-table-wrap"><table><thead><tr><th>Name</th><th>Anmeldestatus</th><th>Letzte Aktivität</th><th>Konto</th><th>Aktion</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><strong>{user.display_name}</strong></td><td><span className={`admin-status ${user.online ? 'active' : 'disabled'}`}>{user.online ? 'Online' : 'Offline'}</span></td><td>{user.last_active_at ? new Date(user.last_active_at * 1000).toLocaleString('de-DE') : '—'}</td><td>{user.status === 'blocked' ? 'Gesperrt' : user.status === 'disabled' ? 'Deaktiviert' : 'Aktiv'}</td><td><div className="admin-row-actions"><button onClick={() => void act(user.id, user.status === 'blocked' ? 'unblock' : 'block')}>{user.status === 'blocked' ? 'Entsperren' : 'Sperren'}</button><button className="danger" onClick={() => void act(user.id, 'disable')}>Deaktivieren</button></div></td></tr>)}</tbody></table></div> : <p className="admin-empty">Keine App-Nutzer gefunden.</p>}
      <div className="admin-user-pagination"><span>Seite {page + 1} von {pageCount}</span><div><button type="button" disabled={page === 0} onClick={() => onPageChange(page - 1)}>Zurück</button><button type="button" disabled={page + 1 >= pageCount} onClick={() => onPageChange(page + 1)}>Weiter</button></div></div>
    </div>
  }

  function SupportSection({ requests }) {
    return <div className="admin-table-card panel"><div className="admin-table-heading"><h2>Support-Anfragen</h2><span>{requests.length} Einträge</span></div>{requests.length ? <div className="admin-table-wrap"><table><thead><tr><th>Betreff</th><th>Kategorie</th><th>Priorität</th><th>Status</th><th>Erstellt</th></tr></thead><tbody>{requests.map((request) => <tr key={request.id}><td><strong>{request.subject}</strong><small>{request.body.slice(0, 90)}</small></td><td>{request.category}</td><td>{request.priority}</td><td>{request.status}</td><td>{new Date(request.created_at * 1000).toLocaleString('de-DE')}</td></tr>)}</tbody></table></div> : <p className="admin-empty">Keine Support-Anfragen vorhanden.</p>}</div>
  }

  function GenericAdminSection({ section }) {
    const [rows, setRows] = useState([])
    const [summary, setSummary] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    useEffect(() => {
      let active = true
      setLoading(true)
      setError('')
      const endpoint = section === 'app'
        ? '/api/admin/app'
        : section === 'updates'
          ? '/api/release/latest'
          : section === 'stats'
            ? '/api/admin/dashboard'
            : `/api/admin/${section === 'premium' ? 'premium' : section === 'features' ? 'features' : section === 'audit' ? 'audit' : section === 'security' ? 'security' : section === 'roles' ? 'roles' : section}`
      adminRequest(endpoint).then((body) => {
        if (!active) return
        setSummary(body)
        setRows(body.subscriptions ?? body.announcements ?? body.audit ?? body.events ?? body.sessions ?? body.settings ?? body.roles ?? [])
      }).catch((caught) => { if (active) setError(caught.message) }).finally(() => { if (active) setLoading(false) })
      return () => { active = false }
    }, [section])
    const names = Object.fromEntries(sections.map(([id, label]) => [id, label]))
    if (loading) return <section className="panel admin-loading-inline" role="status">Daten werden geladen …</section>
    if (error) return <section className="panel admin-error" role="alert">{error}</section>
    if (section === 'backups') {
      const downloadBackup = async () => {
        const response = await fetch('https://infos-vcc.pages.dev/api/admin/backups', { credentials: 'include' })
        if (!response.ok) {
          window.alert((await response.json().catch(() => ({ error: 'Backup konnte nicht erstellt werden.' }))).error)
          return
        }
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `vexlor-admin-backup-${Math.floor(Date.now() / 1000)}.json`
        link.click()
        URL.revokeObjectURL(url)
      }
      return <section className="panel admin-table-card"><div className="admin-table-heading"><h2>Geschützte Datenbank-Backups</h2><button className="primary-button" onClick={() => void downloadBackup()}>JSON-Backup exportieren</button></div><p className="admin-empty">Der Export enthält keine Administrator-Passwörter, Sitzungstokens oder IP-Daten.</p></section>
    }
    if (section === 'updates') {
      return <section className="panel admin-table-card"><div className="admin-table-heading"><h2>Aktuelle Release-Information</h2></div><dl className="admin-key-values"><dt>Version</dt><dd>{summary?.latestVersion ?? summary?.version ?? 'Nicht bereitgestellt'}</dd><dt>Installer</dt><dd>{summary?.downloadUrl ? 'Bereitgestellt' : 'Nicht bereitgestellt'}</dd><dt>Hinweise</dt><dd>{summary?.notes || 'Keine Versionshinweise vorhanden.'}</dd></dl></section>
    }
    if (section === 'premium') {
      return <section className="panel admin-table-card"><div className="admin-table-heading"><h2>Premium-Abonnements</h2><span>{rows.length} Einträge</span></div>{rows.length ? <div className="admin-table-wrap"><table><thead><tr><th>Benutzer</th><th>Status</th><th>Start</th><th>Ablauf</th><th>Quelle</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.display_name || row.user_id}</strong><small>{row.email || ''}</small></td><td>{row.status}</td><td>{new Date(row.starts_at * 1000).toLocaleString('de-DE')}</td><td>{row.expires_at ? new Date(row.expires_at * 1000).toLocaleString('de-DE') : 'Ohne Ablauf'}</td><td>{row.source}</td></tr>)}</tbody></table></div> : <p className="admin-empty">Keine Premium-Abonnements vorhanden.</p>}</section>
    }
    if (section === 'features') {
      return <section className="panel admin-table-card"><div className="admin-table-heading"><h2>{names.features}</h2><span>{Object.keys(summary?.features ?? summary ?? {}).length} Einträge</span></div>{Object.keys(summary?.features ?? {}).length ? <div className="admin-table-wrap"><table><thead><tr><th>Feature</th><th>Status</th><th>Beta</th></tr></thead><tbody>{Object.entries(summary.features).map(([key, feature]) => <tr key={key}><td><strong>{feature.name}</strong><small>{key}</small></td><td>{feature.enabled ? 'Aktiviert' : 'Deaktiviert'}</td><td>{feature.beta ? 'Ja' : 'Nein'}</td></tr>)}</tbody></table></div> : <p className="admin-empty">Keine Feature-Flags vorhanden.</p>}</section>
    }
    if (section === 'app') {
      return <section className="panel admin-table-card"><div className="admin-table-heading"><h2>Globale App-Einstellungen</h2><span>{rows.length} Einträge</span></div>{rows.length ? <div className="admin-table-wrap"><table><thead><tr><th>Schlüssel</th><th>Wert</th><th>Aktualisiert</th></tr></thead><tbody>{rows.map((row) => <tr key={row.key}><td><strong>{row.key}</strong></td><td>{row.value}</td><td>{new Date(row.updated_at * 1000).toLocaleString('de-DE')}</td></tr>)}</tbody></table></div> : <p className="admin-empty">Keine App-Einstellungen vorhanden.</p>}</section>
    }
    if (section === 'audit') {
      return <section className="panel admin-table-card"><div className="admin-table-heading"><h2>Administrator-Protokoll</h2><span>{rows.length} Einträge</span></div>{rows.length ? <div className="admin-table-wrap"><table><thead><tr><th>Aktion</th><th>Ressource</th><th>Ergebnis</th><th>Zeit</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.action}</strong><small>{row.display_name || row.admin_id || 'System'}</small></td><td>{row.resource_type}{row.resource_id ? ` · ${row.resource_id}` : ''}</td><td>{row.result}</td><td>{new Date(row.created_at * 1000).toLocaleString('de-DE')}</td></tr>)}</tbody></table></div> : <p className="admin-empty">Keine Audit-Einträge vorhanden.</p>}</section>
    }
    return <section className="panel admin-table-card"><div className="admin-table-heading"><h2>{names[section]}</h2></div><dl className="admin-key-values">{Object.entries(summary?.system ?? summary ?? {}).map(([key, value]) => <><dt key={`${key}-label`}>{key}</dt><dd key={`${key}-value`}>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd></>)}</dl></section>
  }

  const stats = dashboard?.stats
  const visibleSections = sections.filter(([id]) => id !== 'roles' || admin.roleId === 'super_admin')
  return <div className="admin-page">
    <aside className="admin-navigation panel">
      <div className="admin-nav-heading"><Icon name="spark" /><div><strong>Vexlor Admin</strong><small>{admin.roleName}</small></div></div>
      <nav>{visibleSections.map(([id, label, icon]) => <button key={id} className={section === id ? 'active' : ''} onClick={() => setSection(id)}><Icon name={icon} /><span>{label}</span></button>)}</nav>
      <button className="admin-logout" onClick={() => void logout()}><Icon name="close" /> Abmelden</button>
    </aside>
    <main className="admin-main">
      <header className="admin-main-header"><div><span className="section-kicker">ADMINISTRATION</span><h1>{sections.find(([id]) => id === section)?.[1] ?? 'Admin Dashboard'}</h1></div><span className="admin-secure-badge"><i /> SERVERGEPRÜFT</span></header>
      {error && <div className="admin-error" role="alert">{error}</div>}
      {(section === 'dashboard' || section === 'stats') && <AdminDashboard stats={stats} dashboard={dashboard} />}
      {section === 'users' && <UsersSection
        users={users}
        total={usersTotal}
        page={usersPage}
        search={usersSearch}
        onSearchChange={(search) => { setUsersSearch(search); setUsersPage(0) }}
        onPageChange={setUsersPage}
        reload={() => {
          const params = new URLSearchParams({ limit: '100', offset: String(usersPage * 100), search: usersSearch })
          return adminRequest(`/api/admin/users?${params}`).then((body) => {
            setUsers(body.users ?? [])
            setUsersTotal(Number(body.total ?? 0))
          })
        }}
      />}
      {section === 'codes' && <CodesSection codes={codes} request={adminRequest} reload={() => adminRequest('/api/admin/codes').then((body) => setCodes(body.codes ?? []))} />}
      {section === 'announcements' && <AnnouncementsSection request={adminRequest} />}
      {section === 'roles' && <RolesSection request={adminRequest} currentAdminId={admin.id} />}
      {section === 'support' && <SupportSection requests={support} />}
      {section === 'ticket-mailbox' && <AdminTicketMailbox notifyInfo={notifyInfo} />}
      {!['dashboard', 'stats', 'users', 'codes', 'announcements', 'roles', 'support', 'ticket-mailbox'].includes(section) && <GenericAdminSection section={section} />}
    </main>
  </div>
}
