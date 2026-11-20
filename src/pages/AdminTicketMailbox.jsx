import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import '../styles/tickets.css'

const ticketTypes = [
  ['bug', 'Bug melden'],
  ['technical', 'Technisches Problem'],
  ['question', 'Frage / Support'],
  ['feedback', 'Feedback / Verbesserung'],
  ['other', 'Sonstiges'],
]
const statuses = [
  ['open', 'Offen'],
  ['in_progress', 'In Bearbeitung'],
  ['waiting_user', 'Warten auf Benutzer'],
  ['resolved', 'Gelöst'],
  ['closed', 'Geschlossen'],
]
const priorities = [
  ['low', 'Niedrig'],
  ['normal', 'Mittel'],
  ['high', 'Hoch'],
  ['critical', 'Kritisch'],
]
const typeNames = Object.fromEntries(ticketTypes)
const statusNames = Object.fromEntries(statuses)
const priorityNames = Object.fromEntries(priorities)

async function adminRequest(path, options) {
  const result = await window.vcc.adminRequest(path, options)
  if (result.status < 200 || result.status >= 300) {
    throw new Error(typeof result.body.error === 'string' ? result.body.error : 'Die Admin-Aktion ist fehlgeschlagen.')
  }
  return result.body
}

function formatDate(timestamp) {
  return new Date(timestamp * 1000).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })
}

function Status({ value }) {
  return <span className={`ticket-status ${value}`}>{statusNames[value] ?? value}</span>
}

function Attachments({ attachments }) {
  if (!attachments?.length) return null
  return <div className="ticket-attachments">{attachments.map((file) => <a
    key={file.id}
    href={`data:${file.contentType};base64,${file.data}`}
    download={file.name}
    title={`${file.name} (${Math.ceil(file.byteSize / 1024)} KB)`}
  ><Icon name="save" /><span>{file.name}</span><small>{Math.ceil(file.byteSize / 1024)} KB</small></a>)}</div>
}

export default function AdminTicketMailbox({ notifyInfo }) {
  const [tickets, setTickets] = useState([])
  const [assignees, setAssignees] = useState([])
  const [canManage, setCanManage] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [assignedFilter, setAssignedFilter] = useState('')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [reply, setReply] = useState('')
  const [internal, setInternal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const lastUnreadCount = useRef(null)

  const loadTickets = useCallback(async (silent = false) => {
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (statusFilter) params.set('status', statusFilter)
      if (typeFilter) params.set('type', typeFilter)
      if (assignedFilter) params.set('assigned', assignedFilter)
      if (search.trim()) params.set('q', search.trim())
      const body = await adminRequest(`/api/admin/tickets?${params}`)
      const unreadCount = Number(body.unreadCount) || 0
      setTickets(Array.isArray(body.tickets) ? body.tickets : [])
      setAssignees(Array.isArray(body.assignees) ? body.assignees : [])
      setCanManage(Boolean(body.canManage))
      setError('')
      if (lastUnreadCount.current !== null && unreadCount > lastUnreadCount.current) {
        notifyInfo?.('Ein neues Support-Ticket oder eine neue Antwort ist eingegangen.')
      }
      lastUnreadCount.current = unreadCount
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Ticket-Postfach konnte nicht geladen werden.')
      if (!silent) console.warn('Ticket-Postfach konnte nicht geladen werden:', caught)
    } finally {
      setLoading(false)
    }
  }, [assignedFilter, notifyInfo, search, statusFilter, typeFilter])

  const loadDetail = useCallback(async (id) => {
    try {
      const body = await adminRequest(`/api/admin/tickets/${encodeURIComponent(id)}`)
      setDetail(body.ticket)
      setCanManage(Boolean(body.canManage))
      if (body.ticket) {
        await adminRequest(`/api/admin/tickets/${encodeURIComponent(id)}`, {
          method: 'POST',
          body: JSON.stringify({ action: 'mark-read' }),
        })
      }
      await loadTickets(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Ticket konnte nicht geladen werden.')
    }
  }, [loadTickets])

  useEffect(() => {
    setLoading(true)
    void loadTickets()
    const interval = window.setInterval(() => void loadTickets(true), 30000)
    return () => window.clearInterval(interval)
  }, [loadTickets])

  const selectTicket = async (id) => {
    setSelectedId(id)
    setDetail(null)
    setError('')
    await loadDetail(id)
  }

  const updateTicket = async (body) => {
    if (!selectedId || saving || !canManage) return
    setSaving(true)
    setError('')
    try {
      await adminRequest(`/api/admin/tickets/${encodeURIComponent(selectedId)}`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      await loadDetail(selectedId)
      notifyInfo?.('Ticket wurde aktualisiert.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Ticket konnte nicht aktualisiert werden.')
    } finally {
      setSaving(false)
    }
  }

  const sendMessage = async (event) => {
    event.preventDefault()
    if (!selectedId || !reply.trim() || saving || !canManage) return
    setSaving(true)
    setError('')
    try {
      await adminRequest(`/api/admin/tickets/${encodeURIComponent(selectedId)}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: reply, internal }),
      })
      setReply('')
      await loadDetail(selectedId)
      notifyInfo?.(internal ? 'Interne Notiz wurde gespeichert.' : 'Antwort wurde an den Benutzer gesendet.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Nachricht konnte nicht gesendet werden.')
    } finally {
      setSaving(false)
    }
  }

  return <section className="admin-ticket-mailbox">
    <header className="admin-ticket-toolbar panel">
      <label className="admin-ticket-search"><Icon name="network" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ticketnummer, Titel oder Benutzer suchen" aria-label="Tickets suchen" /></label>
      <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Nach Status filtern"><option value="">Alle Status</option>{statuses.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
      <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Nach Tickettyp filtern"><option value="">Alle Typen</option>{ticketTypes.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
      <select value={assignedFilter} onChange={(event) => setAssignedFilter(event.target.value)} aria-label="Nach Zuweisung filtern"><option value="">Alle Zuweisungen</option><option value="mine">Mir zugewiesen</option><option value="unassigned">Nicht zugewiesen</option></select>
      <button className="subtle-button" onClick={() => void loadTickets()} disabled={loading}><Icon name="refresh" /> Aktualisieren</button>
    </header>
    {error && <div className="ticket-error" role="alert">{error}</div>}
    <div className={`admin-ticket-layout${detail ? ' has-selection' : ''}`}>
      <section className="admin-ticket-list panel">
        <div className="admin-ticket-list-heading"><div><div className="section-kicker">SUPPORT-TEAM</div><h2>Tickets</h2></div><span>{tickets.length} angezeigt</span></div>
        {loading && tickets.length === 0 ? <div className="support-empty" role="status">Tickets werden geladen …</div>
          : tickets.length === 0 ? <div className="support-empty"><Icon name="network" /><strong>Keine Tickets gefunden</strong><span>Ändere die Filter oder warte auf neue Anfragen.</span></div>
            : <div className="admin-ticket-items">{tickets.map((ticket) => <button key={ticket.id} className={`support-ticket-item${selectedId === ticket.id ? ' active' : ''}`} onClick={() => void selectTicket(ticket.id)}>
              <span className="support-ticket-item-top"><b>VCC-{String(ticket.ticket_number).padStart(5, '0')} · {typeNames[ticket.type] ?? ticket.type}</b>{ticket.team_unread > 0 && <i aria-label="Ungelesen" />}</span>
              <strong>{ticket.subject}</strong><span className="support-ticket-item-meta">{ticket.user_name} · {formatDate(ticket.last_activity_at)}</span>
              <span className="support-ticket-item-bottom"><Status value={ticket.status} /><span className={`ticket-priority ${ticket.priority}`}>{priorityNames[ticket.priority] ?? ticket.priority}</span></span>
              <span className="admin-ticket-assignee">{ticket.assignee_name ? `Zugewiesen: ${ticket.assignee_name}` : 'Nicht zugewiesen'}</span>
            </button>)}</div>}
      </section>
      <section className="admin-ticket-detail panel">
        {!selectedId ? <div className="support-empty"><Icon name="network" /><strong>Ticket auswählen</strong><span>Öffne ein Ticket, um Verlauf und Verwaltung zu sehen.</span></div>
          : !detail ? <div className="support-empty" role="status">Ticket wird geladen …</div>
            : <>
              <header className="admin-ticket-detail-heading">
                <div><span className="section-kicker">VCC-{String(detail.ticket_number).padStart(5, '0')} · {typeNames[detail.type]}</span><h2>{detail.subject}</h2><p>{detail.user_name} · Installation {detail.install_id.slice(0, 8)} · Erstellt {formatDate(detail.created_at)}</p></div>
                <div className="admin-ticket-controls">
                  <label>Status<select value={detail.status} disabled={!canManage || saving} onChange={(event) => void updateTicket({ action: 'status', status: event.target.value })}>{statuses.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
                  <label>Priorität<select value={detail.priority} disabled={!canManage || saving} onChange={(event) => void updateTicket({ action: 'priority', priority: event.target.value })}>{priorities.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
                  <label>Zuständig<select value={detail.assigned_admin_id ?? ''} disabled={!canManage || saving} onChange={(event) => void updateTicket({ action: 'assign', assigneeId: event.target.value || null })}><option value="">Nicht zugewiesen</option>{assignees.map((person) => <option key={person.id} value={person.id}>{person.display_name}</option>)}</select></label>
                </div>
              </header>
              <div className="admin-ticket-thread">
                {detail.messages.map((message) => <article key={message.id} className={`support-message ${message.authorType}${message.internal ? ' internal' : ''}`}>
                  <header><strong>{message.internal ? `Interne Notiz · ${message.authorId}` : message.authorType === 'team' ? 'Vexlor Support' : detail.user_name}</strong><time>{formatDate(message.createdAt)}</time></header>
                  <p>{message.body}</p><Attachments attachments={message.attachments} />
                </article>)}
              </div>
              {canManage
                ? <form className={`support-reply-form admin-ticket-reply${internal ? ' internal' : ''}`} onSubmit={(event) => void sendMessage(event)}>
                  <div className="admin-ticket-reply-mode"><label><input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} /> Interne Notiz (nur für das Team)</label><span>{internal ? 'Wird nicht an den Benutzer übermittelt.' : 'Antwort wird an den Benutzer gesendet.'}</span></div>
                  <textarea value={reply} onChange={(event) => setReply(event.target.value)} maxLength={8000} rows={3} placeholder={internal ? 'Interne Notiz verfassen …' : 'Antwort an den Benutzer verfassen …'} required />
                  <div className="support-reply-actions"><span>{saving ? 'Wird gespeichert …' : ''}</span><button className="primary-button" disabled={saving || !reply.trim()}>{internal ? 'Notiz speichern' : 'Antwort senden'}</button></div>
                </form>
                : <div className="admin-ticket-readonly">Du hast Leserechte. Zum Antworten oder Bearbeiten ist die Berechtigung „support.manage“ erforderlich.</div>}
            </>}
      </section>
    </div>
  </section>
}
