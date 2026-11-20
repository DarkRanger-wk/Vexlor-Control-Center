import { useEffect, useState } from 'react'

const rewardLabels = {
  premium: 'Premium-Zeit',
  badge: 'Profilabzeichen',
  profile_frame: 'Profilrahmen',
  profile_color: 'Profilfarbe',
  theme: 'Design',
  beta_access: 'Beta-Zugang',
}
const rewardThemes = [
  ['midnight-blue', 'Midnight Blue'],
  ['cyber-purple', 'Cyber Purple'],
  ['neon-green', 'Neon Green'],
  ['crimson-red', 'Crimson Red'],
  ['arctic-cyan', 'Arctic Cyan'],
  ['golden-black', 'Golden Black'],
  ['rose-pink', 'Rose Pink'],
  ['pure-white', 'Pure White'],
]

const permissionLabels = {
  'users.read': 'Benutzer ansehen',
  'users.manage': 'Benutzer verwalten',
  'codes.manage': 'Codes verwalten',
  'premium.manage': 'Premium verwalten',
  'announcements.manage': 'Ankündigungen verwalten',
  'support.read': 'Support ansehen',
  'support.manage': 'Support verwalten',
  'features.manage': 'Features verwalten',
  'stats.read': 'Statistiken ansehen',
  'audit.read': 'Protokolle ansehen',
}

const emptyCodeForm = {
  name: '',
  code: '',
  rewardType: 'premium',
  rewardValue: '30',
  description: '',
  maxRedemptions: 100,
  expiresAt: '',
  active: true,
}

function localDateTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp * 1000)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function formatReward(type, value) {
  if (type === 'premium') return `Premium · ${Math.max(1, Math.round(Number(value) / 86400))} Tage`
  return `${rewardLabels[type] ?? type}${value ? ` · ${value}` : ''}`
}

function CodeStatus({ code }) {
  const status = code.expires_at && code.expires_at * 1000 <= Date.now()
    ? 'expired'
    : code.current_redemptions >= code.max_redemptions
      ? 'redeemed'
      : code.status
  const labels = { active: 'Aktiv', disabled: 'Deaktiviert', expired: 'Abgelaufen', redeemed: 'Aufgebraucht' }
  return <span className={`admin-status ${status}`}>{labels[status] ?? status}</span>
}

export function CodesSection({ codes, request, reload }) {
  const [form, setForm] = useState(emptyCodeForm)
  const [editingId, setEditingId] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [createdCode, setCreatedCode] = useState('')
  const [redemptions, setRedemptions] = useState(null)

  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    setCreatedCode('')
    try {
      const rewardValue = form.rewardType === 'premium'
        ? String(Math.round(Number(form.rewardValue) * 86400))
        : form.rewardValue.trim()
      const body = {
        action: editingId ? 'update' : 'create',
        id: editingId || undefined,
        name: form.name.trim(),
        code: editingId ? undefined : form.code.trim(),
        reward: { type: form.rewardType, value: rewardValue },
        description: form.description,
        maxRedemptions: Number(form.maxRedemptions),
        expiresAt: form.expiresAt ? Math.floor(new Date(form.expiresAt).getTime() / 1000) : null,
        active: form.active,
      }
      const result = await request('/api/admin/codes', { method: 'POST', body: JSON.stringify(body) })
      if (result.codes?.length) setCreatedCode(result.codes.map((item) => item.code).join(', '))
      setNotice(editingId ? 'Code wurde aktualisiert.' : 'Code wurde erstellt.')
      setForm(emptyCodeForm)
      setEditingId('')
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Code konnte nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  const changeStatus = async (code, action) => {
    setError('')
    setNotice('')
    try {
      await request('/api/admin/codes', { method: 'POST', body: JSON.stringify({ action, id: code.id }) })
      setNotice(action === 'disable' ? 'Code wurde deaktiviert.' : 'Code wurde aktiviert.')
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Code-Status konnte nicht geändert werden.')
    }
  }

  const removeCode = async (code) => {
    if (!window.confirm(`Code „${code.code_name}“ wirklich löschen? Bereits erhaltene Belohnungen bleiben bestehen.`)) return
    setError('')
    setNotice('')
    try {
      await request('/api/admin/codes', { method: 'POST', body: JSON.stringify({ action: 'delete', id: code.id }) })
      setNotice('Code wurde gelöscht. Bereits erhaltene Belohnungen bleiben bestehen.')
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Code konnte nicht gelöscht werden.')
    }
  }

  const editCode = (code) => {
    setEditingId(code.id)
    setCreatedCode('')
    setForm({
      name: code.code_name ?? '',
      code: '',
      rewardType: code.reward_type ?? 'premium',
      rewardValue: code.reward_type === 'premium'
        ? String(Math.max(1, Math.round(Number(code.reward_value) / 86400)))
        : String(code.reward_value ?? ''),
      description: code.description ?? '',
      maxRedemptions: code.max_redemptions,
      expiresAt: localDateTime(code.expires_at),
      active: code.status !== 'disabled',
    })
  }

  const openRedemptions = async (code) => {
    setError('')
    try {
      const result = await request(`/api/admin/codes?id=${encodeURIComponent(code.id)}`)
      setRedemptions({ code: result.code, items: result.redemptions ?? [] })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Einlösungen konnten nicht geladen werden.')
    }
  }

  return <div className="admin-management-stack">
    <section className="panel admin-table-card">
      <div className="admin-table-heading"><h2>{editingId ? 'Code bearbeiten' : 'Normalen Code erstellen'}</h2>{editingId && <button className="admin-secondary-button" onClick={() => { setEditingId(''); setForm(emptyCodeForm) }}>Abbrechen</button>}</div>
      <form className="admin-form-grid" onSubmit={submit}>
        <label>Code-Name<input required maxLength={80} value={form.name} onChange={(event) => updateForm('name', event.target.value)} /></label>
        {!editingId && <label>Eigener Code (optional)<input maxLength={128} value={form.code} onChange={(event) => updateForm('code', event.target.value.toUpperCase())} placeholder="Leer lassen für automatische Generierung" /></label>}
        <label>Belohnungstyp<select value={form.rewardType} onChange={(event) => {
          const rewardType = event.target.value
          setForm((current) => ({
            ...current,
            rewardType,
            rewardValue: rewardType === 'premium' ? '30'
              : rewardType === 'theme' ? 'midnight-blue'
                : rewardType === 'profile_color' ? '#428BFF' : 'founder',
          }))
        }}>{Object.entries(rewardLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label>{form.rewardType === 'premium' ? 'Premium-Dauer (Tage)' : form.rewardType === 'profile_color' ? 'Farbwert (HEX)' : form.rewardType === 'theme' ? 'Freizuschaltendes Design' : 'Belohnungswert'}{form.rewardType === 'theme' ? <select required value={form.rewardValue} onChange={(event) => updateForm('rewardValue', event.target.value)}>{rewardThemes.map(([value, name]) => <option value={value} key={value}>{name}</option>)}</select> : <input required maxLength={200} type={form.rewardType === 'premium' ? 'number' : 'text'} min={form.rewardType === 'premium' ? 1 : undefined} value={form.rewardValue} onChange={(event) => updateForm('rewardValue', event.target.value)} placeholder={form.rewardType === 'profile_color' ? '#428BFF' : ''} />}</label>
        <label>Maximale Einlösungen<input required type="number" min="1" max="100000" value={form.maxRedemptions} onChange={(event) => updateForm('maxRedemptions', event.target.value)} /></label>
        <label>Ablaufdatum (optional)<input type="datetime-local" value={form.expiresAt} onChange={(event) => updateForm('expiresAt', event.target.value)} /></label>
        <label className="admin-form-wide">Beschreibung<textarea maxLength={500} rows={3} value={form.description} onChange={(event) => updateForm('description', event.target.value)} /></label>
        <label className="admin-checkbox admin-form-wide"><input type="checkbox" checked={form.active} onChange={(event) => updateForm('active', event.target.checked)} />Code direkt aktivieren</label>
        <div className="admin-form-hint admin-form-wide">Jeder Code kann pro Installation genau einmal eingelöst werden. Einlösecodes sind normale öffentliche Codes; geheime Codes werden nicht unterstützt.</div>
        <button className="primary-button admin-form-wide" type="submit" disabled={busy}>{busy ? 'Wird gespeichert …' : editingId ? 'Änderungen speichern' : 'Code erstellen'}</button>
      </form>
      {notice && <div className="admin-info-message" role="status">{notice}</div>}
      {createdCode && <div className="admin-code-created"><strong>Code zum Teilen</strong><code>{createdCode}</code></div>}
      {error && <div className="admin-error" role="alert">{error}</div>}
    </section>

    <section className="panel admin-table-card">
      <div className="admin-table-heading"><h2>Codes</h2><span>{codes.length} Einträge</span></div>
      {codes.length ? <div className="admin-table-wrap"><table><thead><tr><th>Code</th><th>Belohnung</th><th>Status</th><th>Einlösungen</th><th>Ablauf</th><th>Aktionen</th></tr></thead><tbody>{codes.map((code) => <tr key={code.id}>
        <td><strong>{code.code_name}</strong><small>{code.public_code}</small></td>
        <td>{formatReward(code.reward_type, code.reward_value)}</td>
        <td><CodeStatus code={code} /></td>
        <td>{code.current_redemptions} / {code.max_redemptions}</td>
        <td>{code.expires_at ? new Date(code.expires_at * 1000).toLocaleString('de-DE') : 'Kein Ablauf'}</td>
        <td><div className="admin-row-actions"><button onClick={() => editCode(code)}>Bearbeiten</button><button onClick={() => void openRedemptions(code)}>Einlöser</button><button onClick={() => void changeStatus(code, code.status === 'disabled' ? 'enable' : 'disable')}>{code.status === 'disabled' ? 'Aktivieren' : 'Deaktivieren'}</button><button className="danger" onClick={() => void removeCode(code)}>Löschen</button></div></td>
      </tr>)}</tbody></table></div> : <p className="admin-empty">Keine Codes vorhanden.</p>}
    </section>

    {redemptions && <div className="admin-modal-backdrop" role="presentation" onClick={() => setRedemptions(null)}>
      <section className="panel admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-redemptions-title" onClick={(event) => event.stopPropagation()}>
        <div className="admin-table-heading"><h2 id="admin-redemptions-title">Einlösungen · {redemptions.code.code_name}</h2><button className="admin-secondary-button" onClick={() => setRedemptions(null)}>Schließen</button></div>
        {redemptions.items.length ? <div className="admin-table-wrap"><table><thead><tr><th>Benutzer</th><th>Installation</th><th>Datum</th></tr></thead><tbody>{redemptions.items.map((entry, index) => <tr key={`${entry.user_id}-${entry.redeemed_at}-${index}`}><td>{entry.display_name || entry.user_id || 'Unbekannt'}</td><td>{entry.install_id}</td><td>{new Date(entry.redeemed_at * 1000).toLocaleString('de-DE')}</td></tr>)}</tbody></table></div> : <p className="admin-empty">Der Code wurde noch nicht eingelöst.</p>}
      </section>
    </div>}
  </div>
}

export function RolesSection({ request, currentAdminId }) {
  const [roles, setRoles] = useState([])
  const [permissions, setPermissions] = useState([])
  const [admins, setAdmins] = useState([])
  const [availablePermissions, setAvailablePermissions] = useState(Object.keys(permissionLabels))
  const [form, setForm] = useState({ name: '', description: '', permissions: [] })
  const [editingId, setEditingId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const body = await request('/api/admin/roles')
    setRoles(body.roles ?? [])
    setPermissions(body.permissions ?? [])
    setAdmins(body.admins ?? [])
    setAvailablePermissions(body.availablePermissions ?? Object.keys(permissionLabels))
  }

  useEffect(() => {
    let active = true
    request('/api/admin/roles').then((body) => {
      if (!active) return
      setRoles(body.roles ?? [])
      setPermissions(body.permissions ?? [])
      setAdmins(body.admins ?? [])
      setAvailablePermissions(body.availablePermissions ?? Object.keys(permissionLabels))
    }).catch((caught) => { if (active) setError(caught.message) })
    return () => { active = false }
  }, [])

  const togglePermission = (permission) => setForm((current) => ({
    ...current,
    permissions: current.permissions.includes(permission)
      ? current.permissions.filter((item) => item !== permission)
      : [...current.permissions, permission],
  }))

  const saveRole = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await request('/api/admin/roles', { method: 'POST', body: JSON.stringify({
        action: editingId ? 'update' : 'create',
        roleId: editingId || undefined,
        ...form,
      }) })
      setForm({ name: '', description: '', permissions: [] })
      setEditingId('')
      setNotice(editingId ? 'Rolle wurde aktualisiert.' : 'Rolle wurde erstellt.')
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Rolle konnte nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  const assignRole = async (adminId, roleId) => {
    setError('')
    try {
      await request('/api/admin/roles', { method: 'POST', body: JSON.stringify({ action: 'assign', adminId, roleId }) })
      setNotice('Rolle wurde zugewiesen. Das Teammitglied muss sich erneut anmelden.')
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Rolle konnte nicht zugewiesen werden.')
    }
  }

  const editRole = (role) => {
    setEditingId(role.id)
    setForm({
      name: role.name,
      description: role.description,
      permissions: permissions.filter((item) => item.role_id === role.id).map((item) => item.permission),
    })
  }

  const deleteRole = async (role) => {
    if (!window.confirm(`Rolle „${role.name}“ wirklich löschen?`)) return
    setError('')
    try {
      await request('/api/admin/roles', { method: 'POST', body: JSON.stringify({ action: 'delete', roleId: role.id }) })
      setNotice('Rolle wurde gelöscht.')
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Rolle konnte nicht gelöscht werden.')
    }
  }

  return <div className="admin-management-stack">
    <section className="panel admin-table-card">
      <div className="admin-table-heading"><h2>Teammitglieder</h2><span>{admins.length} Einträge</span></div>
      {admins.length ? <div className="admin-table-wrap"><table><thead><tr><th>Name</th><th>Status</th><th>Rolle</th><th>Letzte Änderung</th></tr></thead><tbody>{admins.map((member) => <tr key={member.id}>
        <td><strong>{member.display_name}</strong><small>{member.id}</small></td>
        <td><span className={`admin-status ${member.status}`}>{member.status === 'active' ? 'Aktiv' : member.status}</span></td>
        <td><select value={member.role_id} disabled={member.id === currentAdminId} onChange={(event) => void assignRole(member.id, event.target.value)} aria-label={`Rolle für ${member.display_name}`}><option value="" disabled>Rolle wählen</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></td>
        <td>{new Date(member.updated_at * 1000).toLocaleString('de-DE')}</td>
      </tr>)}</tbody></table></div> : <p className="admin-empty">Keine Teammitglieder gefunden.</p>}
    </section>

    <section className="panel admin-table-card">
      <div className="admin-table-heading"><h2>{editingId ? 'Rolle bearbeiten' : 'Rolle erstellen'}</h2>{editingId && <button className="admin-secondary-button" onClick={() => { setEditingId(''); setForm({ name: '', description: '', permissions: [] }) }}>Abbrechen</button>}</div>
      <form className="admin-form-grid" onSubmit={saveRole}>
        <label>Rollenname<input required maxLength={48} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
        <label className="admin-form-wide">Beschreibung<input required maxLength={200} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label>
        <fieldset className="admin-permission-grid admin-form-wide"><legend>Berechtigungen</legend>{availablePermissions.map((permission) => <label className="admin-checkbox" key={permission}><input type="checkbox" checked={form.permissions.includes(permission)} onChange={() => togglePermission(permission)} />{permissionLabels[permission] ?? permission}</label>)}</fieldset>
        <div className="admin-form-hint admin-form-wide">Die integrierten Rollen und der Super-Administrator-Vollzugriff bleiben unverändert. Teamrollen können nur von Super-Administratoren verwaltet werden.</div>
        <button className="primary-button admin-form-wide" type="submit" disabled={busy}>{busy ? 'Wird gespeichert …' : editingId ? 'Änderungen speichern' : 'Rolle erstellen'}</button>
      </form>
      {notice && <div className="admin-info-message" role="status">{notice}</div>}
      {error && <div className="admin-error" role="alert">{error}</div>}
    </section>

    <section className="panel admin-table-card">
      <div className="admin-table-heading"><h2>Rollen und Rechte</h2><span>{roles.length} Rollen</span></div>
      {roles.length ? <div className="admin-table-wrap"><table><thead><tr><th>Rolle</th><th>Berechtigungen</th><th>Aktionen</th></tr></thead><tbody>{roles.map((role) => {
        const rolePermissions = permissions.filter((item) => item.role_id === role.id).map((item) => item.permission)
        const builtIn = ['super_admin', 'admin', 'moderator'].includes(role.id)
        return <tr key={role.id}><td><strong>{role.name}</strong><small>{role.description}</small></td><td>{rolePermissions.includes('*') ? 'Vollzugriff' : rolePermissions.map((permission) => permissionLabels[permission] ?? permission).join(', ') || 'Keine'}</td><td><div className="admin-row-actions">{!builtIn && <><button onClick={() => editRole(role)}>Bearbeiten</button><button className="danger" onClick={() => void deleteRole(role)}>Löschen</button></>}</div></td></tr>
      })}</tbody></table></div> : <p className="admin-empty">Keine Rollen vorhanden.</p>}
    </section>
    {error && <div className="admin-error" role="alert">{error}</div>}
  </div>
}

const emptyAnnouncement = { title: '', body: '', startsAt: '', expiresAt: '', active: true, kind: 'code' }

export function AnnouncementsSection({ request }) {
  const [announcements, setAnnouncements] = useState([])
  const [form, setForm] = useState(emptyAnnouncement)
  const [editingId, setEditingId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const result = await request('/api/admin/announcements')
    setAnnouncements(result.announcements ?? [])
  }

  useEffect(() => {
    let active = true
    request('/api/admin/announcements').then((result) => {
      if (active) setAnnouncements(result.announcements ?? [])
    }).catch((caught) => { if (active) setError(caught.message) })
    return () => { active = false }
  }, [])

  const save = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await request('/api/admin/announcements', { method: 'POST', body: JSON.stringify({
        action: editingId ? 'update' : 'create',
        id: editingId || undefined,
        title: form.title,
        body: form.body,
        kind: form.kind,
        active: form.active,
        startsAt: form.startsAt ? Math.floor(new Date(form.startsAt).getTime() / 1000) : null,
        expiresAt: form.expiresAt ? Math.floor(new Date(form.expiresAt).getTime() / 1000) : null,
      }) })
      setForm(emptyAnnouncement)
      setEditingId('')
      setNotice(editingId ? 'Ankündigung aktualisiert.' : 'Ankündigung veröffentlicht.')
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Ankündigung konnte nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  const edit = (announcement) => {
    setEditingId(announcement.id)
    setForm({
      title: announcement.title,
      body: announcement.body,
      startsAt: localDateTime(announcement.starts_at),
      expiresAt: localDateTime(announcement.expires_at),
      active: Boolean(announcement.active),
      kind: announcement.kind,
    })
  }

  const remove = async (announcement) => {
    if (!window.confirm(`Ankündigung „${announcement.title}“ löschen?`)) return
    setError('')
    try {
      await request('/api/admin/announcements', { method: 'POST', body: JSON.stringify({ action: 'delete', id: announcement.id }) })
      setNotice('Ankündigung gelöscht.')
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Ankündigung konnte nicht gelöscht werden.')
    }
  }

  return <div className="admin-management-stack">
    <section className="panel admin-table-card">
      <div className="admin-table-heading"><h2>{editingId ? 'Ankündigung bearbeiten' : 'Ankündigung erstellen'}</h2>{editingId && <button className="admin-secondary-button" onClick={() => { setEditingId(''); setForm(emptyAnnouncement) }}>Abbrechen</button>}</div>
      <form className="admin-form-grid" onSubmit={save}>
        <label>Titel<input required maxLength={120} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></label>
        <label>Typ<select value={form.kind} onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value }))}><option value="code">Code-Ankündigung</option><option value="feature">Feature</option><option value="info">Information</option><option value="warning">Warnung</option><option value="maintenance">Wartung</option></select></label>
        <label className="admin-form-wide">Beschreibung<textarea required rows={3} maxLength={4000} value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} /></label>
        <label>Startzeit (optional)<input type="datetime-local" value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} /></label>
        <label>Ablaufdatum (optional)<input type="datetime-local" value={form.expiresAt} onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))} /></label>
        <label className="admin-checkbox"><input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} />Sofort aktiv</label>
        <button className="primary-button admin-form-wide" type="submit" disabled={busy}>{busy ? 'Wird gespeichert …' : editingId ? 'Änderungen speichern' : 'Ankündigung veröffentlichen'}</button>
      </form>
      {notice && <div className="admin-info-message" role="status">{notice}</div>}
      {error && <div className="admin-error" role="alert">{error}</div>}
    </section>
    <section className="panel admin-table-card">
      <div className="admin-table-heading"><h2>Ankündigungen</h2><span>{announcements.length} Einträge</span></div>
      {announcements.length ? <div className="admin-table-wrap"><table><thead><tr><th>Titel</th><th>Typ</th><th>Status</th><th>Ablauf</th><th>Aktionen</th></tr></thead><tbody>{announcements.map((announcement) => <tr key={announcement.id}>
        <td><strong>{announcement.title}</strong><small>{announcement.body}</small></td>
        <td>{announcement.kind === 'code' ? 'Code' : announcement.kind}</td>
        <td><span className={`admin-status ${announcement.active ? 'active' : 'disabled'}`}>{announcement.active ? 'Aktiv' : 'Deaktiviert'}</span></td>
        <td>{announcement.expires_at ? new Date(announcement.expires_at * 1000).toLocaleString('de-DE') : 'Kein Ablauf'}</td>
        <td><div className="admin-row-actions"><button onClick={() => edit(announcement)}>Bearbeiten</button><button className="danger" onClick={() => void remove(announcement)}>Löschen</button></div></td>
      </tr>)}</tbody></table></div> : <p className="admin-empty">Keine Ankündigungen vorhanden.</p>}
    </section>
  </div>
}
