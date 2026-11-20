import { getRequestIp, randomToken, securityEvent, sha256Hex } from '../_shared/admin-auth.js';
import {
  parseTicketAttachments,
  readTicketBody,
  requireTicketIdentity,
  ticketError,
  validateTicketText,
} from '../_shared/tickets.js';

const ticketTypes = new Set(['bug', 'technical', 'question', 'feedback', 'other']);
const priorities = new Set(['low', 'normal', 'high', 'critical']);

export async function onRequestGet({ request, env }) {
  const auth = await requireTicketIdentity(request, env);
  if (auth.response) return auth.response;
  if (!auth.identity) return Response.json({ ok: true, tickets: [], unreadCount: 0 });

  try {
    const [result, unread] = await Promise.all([
      env.DB.prepare(`
      SELECT ticket_number, id, type, subject, priority, status, created_at, updated_at, last_activity_at, user_unread
      FROM tickets
      WHERE install_id = ?
      ORDER BY last_activity_at DESC
      LIMIT 100
      `).bind(auth.identity.installId).all(),
      env.DB.prepare(`
        SELECT COALESCE(SUM(user_unread), 0) AS count FROM tickets WHERE install_id = ?
      `).bind(auth.identity.installId).first(),
    ]);
    const tickets = result.results ?? [];
    return Response.json({
      ok: true,
      tickets,
      unreadCount: Number(unread?.count ?? 0),
    });
  } catch (error) {
    console.error('Ticketliste konnte nicht geladen werden:', error);
    return ticketError('Tickets konnten nicht geladen werden.', 500);
  }
}

export async function onRequestPost({ request, env }) {
  const auth = await requireTicketIdentity(request, env, true);
  if (auth.response) return auth.response;
  const parsed = await readTicketBody(request);
  if (parsed.response) return parsed.response;
  const body = parsed.body;
  const type = typeof body.type === 'string' ? body.type : '';
  const subject = validateTicketText(body.subject, 160);
  const description = validateTicketText(body.description, 8000);
  const priority = priorities.has(body.priority) ? body.priority : 'normal';
  if (!ticketTypes.has(type) || !subject || !description) {
    return ticketError('Tickettyp, Betreff und Beschreibung sind erforderlich.', 400);
  }

  const formData = {};
  if (type === 'bug') {
    const steps = validateTicketText(body.steps, 4000);
    const expected = validateTicketText(body.expected, 2000);
    const actual = validateTicketText(body.actual, 2000);
    if (!steps || !expected || !actual) {
      return ticketError('Bitte beschreibe die Schritte, das erwartete Ergebnis und das tatsächliche Ergebnis.', 400);
    }
    formData.steps = steps;
    formData.expected = expected;
    formData.actual = actual;
  }
  const attachmentsResult = parseTicketAttachments(body.attachments);
  if (attachmentsResult.response) return attachmentsResult.response;

  const now = Math.floor(Date.now() / 1000);
  try {
    const ipHash = await sha256Hex(getRequestIp(request));
    const recentIpAttempts = await env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM security_events
      WHERE event_type = 'ticket.creation.attempt' AND ip_hash = ? AND created_at >= ?
    `).bind(ipHash, now - 24 * 60 * 60).first();
    if (Number(recentIpAttempts?.count ?? 0) >= 20) {
      return ticketError('Zu viele Tickets wurden von diesem Netzwerk erstellt. Bitte später erneut versuchen.', 429);
    }
    await securityEvent(env.DB, request, null, 'ticket.creation.attempt');

    const recent = await env.DB.prepare(`
      SELECT COUNT(*) AS count FROM tickets WHERE install_id = ? AND created_at >= ?
    `).bind(auth.identity.installId, now - 24 * 60 * 60).first();
    if (Number(recent?.count ?? 0) >= 10) {
      return ticketError('Du hast heute bereits zehn Tickets erstellt. Bitte warte bis morgen.', 429);
    }

    const id = randomToken(16);
    const messageId = randomToken(16);
    const messageBody = type === 'bug'
      ? `${description}\n\nWas hast du gemacht?\n${formData.steps}\n\nWas hätte passieren sollen?\n${formData.expected}\n\nWas ist stattdessen passiert?\n${formData.actual}`
      : description;
    const statements = [
      env.DB.prepare(`
        INSERT INTO tickets
          (id, install_id, type, subject, priority, status, form_data, user_unread, team_unread, created_at, updated_at, last_activity_at)
        VALUES (?, ?, ?, ?, ?, 'open', ?, 0, 1, ?, ?, ?)
      `).bind(id, auth.identity.installId, type, subject, priority, JSON.stringify(formData), now, now, now),
      env.DB.prepare(`
        INSERT INTO ticket_messages (id, ticket_number, author_type, author_id, is_internal, body, created_at)
        SELECT ?, ticket_number, 'user', ?, 0, ?, ? FROM tickets WHERE id = ?
      `).bind(messageId, auth.identity.installId, messageBody, now, id),
      ...attachmentsResult.attachments.map((file) => env.DB.prepare(`
        INSERT INTO ticket_attachments
          (id, ticket_number, message_id, file_name, content_type, byte_size, content, created_at)
        SELECT ?, ticket_number, ?, ?, ?, ?, ?, ? FROM tickets WHERE id = ?
      `).bind(file.id, messageId, file.fileName, file.contentType, file.bytes.byteLength, file.bytes, now, id)),
    ];
    await env.DB.batch(statements);
    const created = await env.DB.prepare('SELECT ticket_number FROM tickets WHERE id = ? AND install_id = ?')
      .bind(id, auth.identity.installId).first();
    if (!created) throw new Error('Das Ticket wurde nach dem Speichern nicht gefunden.');
    return Response.json({ ok: true, ticket: { id, ticketNumber: created.ticket_number } }, { status: 201 });
  } catch (error) {
    console.error('Ticket konnte nicht erstellt werden:', error);
    return ticketError('Das Ticket konnte nicht gespeichert werden.', 500);
  }
}
