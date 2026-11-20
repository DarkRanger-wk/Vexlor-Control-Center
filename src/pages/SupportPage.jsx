import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import '../styles/tickets.css'

const ticketTypes = [
  { id: 'bug', title: 'Bug melden', detail: 'Ein Fehler oder unerwartetes Verhalten', icon: 'target' },
  { id: 'technical', title: 'Technisches Problem', detail: 'Installation, Updates oder Systemfehler', icon: 'cpu' },
  { id: 'question', title: 'Frage / Support', detail: 'Hilfe bei der Verwendung der App', icon: 'network' },
  { id: 'feedback', title: 'Feedback / Verbesserung', detail: 'Ideen und allgemeines Feedback', icon: 'spark' },
  { id: 'other', title: 'Sonstiges', detail: 'Ein anderes Anliegen', icon: 'arrow' },
]

const typeLabels = Object.fromEntries(ticketTypes.map((type) => [type.id, type.title]))
const statusLabels = {
  open: 'Offen',
  in_progress: 'In Bearbeitung',
  waiting_user: 'Warten auf Benutzer',
  resolved: 'Gelöst',
  closed: 'Geschlossen',
}
const priorityLabels = { low: 'Niedrig', normal: 'Mittel', high: 'Hoch', critical: 'Kritisch' }
const attachmentAccept = '.png,.jpg,.jpeg,.webp,.txt,.pdf'
const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'text/plain', 'application/pdf'])
const maxFileSize = 512 * 1024
const maxTotalSize = 1024 * 1024

async function apiRequest(path, options) {
  const result = await window.vcc.ticketRequest(path, options)
  if (result.status < 200 || result.status >= 300) {
    throw new Error(typeof result.body.error === 'string' ? result.body.error : 'Die Ticket-Aktion ist fehlgeschlagen.')
  }
  return result.body
}

async function prepareAttachments(files) {
  const attachments = []
  for (const file of files) {
    if (!allowedTypes.has(file.type) || file.size <= 0 || file.size > maxFileSize) {
      throw new Error('Anhänge müssen PNG, JPEG, WebP, TXT oder PDF sein und dürfen jeweils höchstens 512 KB groß sein.')
    }
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Datei konnte nicht gelesen werden.'))
      reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'))
      reader.readAsDataURL(file)
    })
    attachments.push({
      name: file.name,
      contentType: file.type,
      data: dataUrl.slice(dataUrl.indexOf(',') + 1),
    })
  }
  if (attachments.length > 3 || files.reduce((total, file) => total + file.size, 0) > maxTotalSize) {
    throw new Error('Es sind höchstens drei Anhänge mit zusammen maximal 1 MB erlaubt.')
  }
  return attachments
}

function formatDate(timestamp) {
  return new Date(timestamp * 1000).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })
}

function TicketStatus({ status }) {
  return <span className={`ticket-status ${status}`}>{statusLabels[status] ?? status}</span>
}

function TicketPriority({ priority }) {
  return <span className={`ticket-priority ${priority}`}>{priorityLabels[priority] ?? priority}</span>
}

function AttachmentLinks({ attachments }) {
  if (!attachments?.length) return null
  return <div className="ticket-attachments">{attachments.map((file) => <a
    key={file.id}
    href={`data:${file.contentType};base64,${file.data}`}
    download={file.name}
    title={`${file.name} (${Math.ceil(file.byteSize / 1024)} KB)`}
  ><Icon name="save" /><span>{file.name}</span><small>{Math.ceil(file.byteSize / 1024)} KB</small></a>)}</div>
}

export default function SupportPage({ username, notifyInfo }) {
  const [view, setView] = useState('create')
  const [type, setType] = useState('bug')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState('')
  const [expected, setExpected] = useState('')
  const [actual, setActual] = useState('')
  const [priority, setPriority] = useState('normal')
  const [files, setFiles] = useState([])
  const [tickets, setTickets] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [reply, setReply] = useState('')
  const [replyFiles, setReplyFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const loadTickets = useCallback(async (silent = false) => {
    try {
      const body = await apiRequest('/api/tickets')
      const nextTickets = Array.isArray(body.tickets) ? body.tickets : []
      setTickets(nextTickets)
      setError('')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Tickets konnten nicht geladen werden.'
      setError(message)
      if (!silent) console.warn('Ticketliste konnte nicht geladen werden:', caught)
    }
  }, [notifyInfo])

  const loadTicket = useCallback(async (id, silent = false) => {
    try {
      const body = await apiRequest(`/api/tickets/${encodeURIComponent(id)}`)
      setSelectedTicket(body.ticket)
      setError('')
      await loadTickets(true)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Ticket konnte nicht geladen werden.'
      setError(message)
      if (!silent) console.warn('Ticket konnte nicht geladen werden:', caught)
    }
  }, [loadTickets])

  useEffect(() => {
    setLoading(true)
    void loadTickets().finally(() => setLoading(false))
    const interval = window.setInterval(() => {
      void loadTickets(true)
      if (selectedId) void loadTicket(selectedId, true)
    }, 30000)
    return () => window.clearInterval(interval)
  }, [loadTicket, loadTickets, selectedId])

  const chooseFiles = (event, update) => {
    const selected = Array.from(event.target.files ?? [])
    update((current) => [...current, ...selected].slice(0, 3))
    event.target.value = ''
  }

  const createTicket = async (event) => {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      const attachments = await prepareAttachments(files)
      const body = await apiRequest('/api/tickets', {
        method: 'POST',
        body: JSON.stringify({
          type,
          subject,
          description,
          steps,
          expected,
          actual,
          priority,
          attachments,
        }),
      })
      const ticketId = body.ticket?.id
      setSubject('')
      setDescription('')
      setSteps('')
      setExpected('')
      setActual('')
      setFiles([])
      setView('tickets')
      await loadTickets()
      if (ticketId) {
        setSelectedId(ticketId)
        await loadTicket(ticketId)
      }
      notifyInfo?.('Dein Ticket wurde erstellt.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Ticket konnte nicht erstellt werden.')
    } finally {
      setSubmitting(false)
    }
  }

  const sendReply = async (event) => {
    event.preventDefault()
    if (!selectedTicket || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const attachments = await prepareAttachments(replyFiles)
      await apiRequest(`/api/tickets/${encodeURIComponent(selectedTicket.id)}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: reply, attachments }),
      })
      setReply('')
      setReplyFiles([])
      await loadTicket(selectedTicket.id)
      await loadTickets()
      notifyInfo?.('Deine Antwort wurde gesendet.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Antwort konnte nicht gesendet werden.')
    } finally {
      setSubmitting(false)
    }
  }

  const selectTicket = async (id) => {
    setSelectedId(id)
    setSelectedTicket(null)
    setError('')
    setLoading(true)
    await loadTicket(id)
    setLoading(false)
  }

  const selectView = (nextView, nextType) => {
    setView(nextView)
    setSelectedId(null)
    setSelectedTicket(null)
    setError('')
    if (nextType) setType(nextType)
  }

  return <section className="support-page">
    <header className="page-intro support-intro">
      <div><div className="eyebrow"><span className="eyebrow-line" /> VEXLOR SUPPORT</div><h1>Support <span>& Hilfe</span></h1><p className="welcome-subtitle">Melde Fehler, stelle Fragen oder teile deine Ideen direkt mit dem Vexlor-Team.</p></div>
      <div className="support-local-note"><Icon name="network" /><span>Privat an diese App-Installation gebunden</span></div>
    </header>

    <nav className="support-tabs" aria-label="Support-Bereiche">
      <button className={view === 'create' && type === 'bug' ? 'active' : ''} onClick={() => selectView('create', 'bug')}>Bug melden</button>
      <button className={view === 'create' && ['technical', 'question', 'other'].includes(type) ? 'active' : ''} onClick={() => selectView('create', 'technical')}>Support anfordern</button>
      <button className={view === 'create' && type === 'feedback' ? 'active' : ''} onClick={() => selectView('create', 'feedback')}>Allgemeines Feedback</button>
      <button className={view === 'tickets' ? 'active' : ''} onClick={() => selectView('tickets')}>Meine Tickets{tickets.some((ticket) => ticket.user_unread) && <span className="support-tab-unread">{tickets.filter((ticket) => ticket.user_unread).length}</span>}</button>
    </nav>

    {error && <div className="ticket-error" role="alert">{error}</div>}
    {view === 'create' && <div className="support-create-layout">
      <section className="support-type-list panel">
        <div className="section-kicker">WAS MÖCHTEST DU TUN?</div>
        {ticketTypes.map((option) => <button key={option.id} className={`support-type-option${type === option.id ? ' active' : ''}`} onClick={() => setType(option.id)}>
          <span className="support-type-icon"><Icon name={option.icon} /></span><span><strong>{option.title}</strong><small>{option.detail}</small></span><span className="support-type-check">›</span>
        </button>)}
      </section>
      <form className="support-form panel" onSubmit={(event) => void createTicket(event)}>
        <div className="support-form-heading"><div><div className="section-kicker">NEUES TICKET</div><h2>{typeLabels[type]}</h2></div><span className="support-user-label">{username || 'Lokaler Nutzer'}</span></div>
        <label className="support-field">{type === 'bug' ? 'Titel des Bugs' : 'Betreff'}
          <input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={160} placeholder={type === 'bug' ? 'Was funktioniert nicht?' : 'Worum geht es?'} required />
        </label>
        <label className="support-field">{type === 'bug' ? 'Ausführliche Beschreibung' : 'Beschreibung'}
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={8000} rows={5} placeholder="Beschreibe dein Anliegen möglichst genau." required />
        </label>
        {type === 'bug' && <div className="support-bug-fields">
          <label className="support-field">Was hast du gemacht, bevor der Fehler auftrat?
            <textarea value={steps} onChange={(event) => setSteps(event.target.value)} maxLength={4000} rows={3} required />
          </label>
          <label className="support-field">Was hätte passieren sollen?
            <textarea value={expected} onChange={(event) => setExpected(event.target.value)} maxLength={2000} rows={2} required />
          </label>
          <label className="support-field">Was ist stattdessen passiert?
            <textarea value={actual} onChange={(event) => setActual(event.target.value)} maxLength={2000} rows={2} required />
          </label>
          <label className="support-field">Schweregrad
            <select value={priority} onChange={(event) => setPriority(event.target.value)}>
              {Object.entries(priorityLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
        </div>}
        <label className="support-field">Dateien anhängen <span className="support-optional">(optional · PNG, JPEG, WebP, TXT oder PDF)</span>
          <input type="file" accept={attachmentAccept} multiple onChange={(event) => chooseFiles(event, setFiles)} />
        </label>
        {files.length > 0 && <div className="support-selected-files">{files.map((file, index) => <span key={`${file.name}-${index}`}>{file.name}<button type="button" onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} aria-label={`${file.name} entfernen`}>×</button></span>)}</div>}
        <p className="support-file-hint">Bis zu 3 Dateien, je maximal 512 KB (zusammen maximal 1 MB).</p>
        <div className="support-form-footer"><span>Deine Angaben werden verschlüsselt übertragen.</span><button className="primary-button" disabled={submitting}>{submitting ? 'Wird gesendet …' : 'Ticket erstellen'}</button></div>
      </form>
    </div>}

    {view === 'tickets' && <div className={`support-tickets-layout${selectedTicket ? ' has-selection' : ''}`}>
      <section className="support-ticket-list panel">
        <div className="support-ticket-list-heading"><div><div className="section-kicker">PERSÖNLICH</div><h2>Meine Tickets</h2></div><button className="subtle-button" onClick={() => void loadTickets()} disabled={loading}><Icon name="refresh" /> Aktualisieren</button></div>
        {loading && tickets.length === 0 ? <div className="support-empty" role="status">Tickets werden geladen …</div>
          : tickets.length === 0 ? <div className="support-empty"><Icon name="network" /><strong>Noch keine Tickets</strong><span>Deine Anfragen und Antworten erscheinen hier.</span><button className="primary-button" onClick={() => selectView('create', 'question')}>Support kontaktieren</button></div>
            : <div className="support-ticket-items">{tickets.map((ticket) => <button key={ticket.id} className={`support-ticket-item${selectedId === ticket.id ? ' active' : ''}`} onClick={() => void selectTicket(ticket.id)}>
              <span className="support-ticket-item-top"><b>VCC-{String(ticket.ticket_number).padStart(5, '0')}</b>{ticket.user_unread > 0 && <i aria-label="Ungelesene Antwort" />}</span>
              <strong>{ticket.subject}</strong><span className="support-ticket-item-meta">{typeLabels[ticket.type] ?? ticket.type} · {formatDate(ticket.last_activity_at)}</span>
              <span className="support-ticket-item-bottom"><TicketStatus status={ticket.status} /><TicketPriority priority={ticket.priority} /></span>
            </button>)}</div>}
      </section>
      <section className="support-thread panel">
        {!selectedId ? <div className="support-empty"><Icon name="network" /><strong>Ticket auswählen</strong><span>Wähle links ein Ticket aus, um den Verlauf zu sehen.</span></div>
          : loading && !selectedTicket ? <div className="support-empty" role="status">Ticket wird geladen …</div>
            : selectedTicket && <>
              <header className="support-thread-header"><div><span className="section-kicker">VCC-{String(selectedTicket.ticket_number).padStart(5, '0')} · {typeLabels[selectedTicket.type]}</span><h2>{selectedTicket.subject}</h2><span className="support-thread-date">Erstellt am {formatDate(selectedTicket.created_at)}</span></div><div><TicketStatus status={selectedTicket.status} /><TicketPriority priority={selectedTicket.priority} /></div></header>
              <div className="support-message-list">{selectedTicket.messages.map((message) => <article key={message.id} className={`support-message ${message.authorType}`}>
                <header><strong>{message.authorType === 'team' ? 'Vexlor Support' : username || 'Du'}</strong><time>{formatDate(message.createdAt)}</time></header>
                <p>{message.body}</p><AttachmentLinks attachments={message.attachments} />
              </article>)}</div>
              {selectedTicket.status === 'closed'
                ? <div className="support-closed-note">Dieses Ticket ist geschlossen. Erstelle ein neues Ticket, falls du weitere Hilfe benötigst.</div>
                : <form className="support-reply-form" onSubmit={(event) => void sendReply(event)}>
                  <label htmlFor="support-reply">Antwort an das Support-Team</label>
                  <textarea id="support-reply" value={reply} onChange={(event) => setReply(event.target.value)} maxLength={8000} rows={3} placeholder="Schreibe deine Antwort …" required />
                  <div className="support-reply-actions"><label className="support-attach-button"><Icon name="save" /> Datei anhängen<input type="file" accept={attachmentAccept} multiple onChange={(event) => chooseFiles(event, setReplyFiles)} /></label><button className="primary-button" disabled={submitting || !reply.trim()}>{submitting ? 'Wird gesendet …' : 'Antwort senden'}</button></div>
                  {replyFiles.length > 0 && <div className="support-selected-files">{replyFiles.map((file, index) => <span key={`${file.name}-${index}`}>{file.name}<button type="button" onClick={() => setReplyFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} aria-label={`${file.name} entfernen`}>×</button></span>)}</div>}
                </form>}
            </>}
      </section>
    </div>}
  </section>
}
