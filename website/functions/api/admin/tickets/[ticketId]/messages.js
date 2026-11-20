import { audit, randomToken, requireAdmin } from '../../../../_shared/admin-auth.js';
import {
  isTicketId,
  parseTicketAttachments,
  readTicketBody,
  ticketError,
  validateTicketText,
} from '../../../../_shared/tickets.js';

export async function onRequestPost({ request, env, params }) {
  if (!env.DB) return ticketError('Die Ticket-Datenbank ist nicht konfiguriert.', 503);
  const auth = await requireAdmin(request, env, env.DB, 'support.manage');
  if (auth.error) return ticketError(auth.error, auth.status);
  if (!isTicketId(params.ticketId)) return ticketError('Ticket nicht gefunden.', 404);
  const parsed = await readTicketBody(request);
  if (parsed.response) return parsed.response;
  const body = validateTicketText(parsed.body.body, 8000);
  const internal = parsed.body.internal === true;
  if (!body) return ticketError('Eine Nachricht darf nicht leer sein.', 400);
  const attachmentsResult = parseTicketAttachments(parsed.body.attachments);
  if (attachmentsResult.response) return attachmentsResult.response;

  try {
    const ticket = await env.DB.prepare('SELECT ticket_number FROM tickets WHERE id = ?')
      .bind(params.ticketId).first();
    if (!ticket) return ticketError('Ticket nicht gefunden.', 404);
    const messageId = randomToken(16);
    const now = Math.floor(Date.now() / 1000);
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO ticket_messages (id, ticket_number, author_type, author_id, is_internal, body, created_at)
        VALUES (?, ?, 'team', ?, ?, ?, ?)
      `).bind(messageId, ticket.ticket_number, auth.admin.id, internal ? 1 : 0, body, now),
      ...attachmentsResult.attachments.map((file) => env.DB.prepare(`
        INSERT INTO ticket_attachments
          (id, ticket_number, message_id, file_name, content_type, byte_size, content, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(file.id, ticket.ticket_number, messageId, file.fileName, file.contentType, file.bytes.byteLength, file.bytes, now)),
      env.DB.prepare(`
        UPDATE tickets
        SET user_unread = CASE WHEN ? = 0 THEN 1 ELSE user_unread END,
            status = CASE WHEN ? = 0 THEN 'waiting_user' ELSE status END,
            team_unread = 0, updated_at = ?, last_activity_at = ?
        WHERE ticket_number = ?
      `).bind(internal ? 1 : 0, internal ? 1 : 0, now, now, ticket.ticket_number),
    ]);
    await audit(env.DB, auth.admin.id, internal ? 'ticket.note.added' : 'ticket.replied', 'ticket', params.ticketId, 'success');
    return Response.json({ ok: true, messageId }, { status: 201 });
  } catch (error) {
    console.error('Teamnachricht konnte nicht gespeichert werden:', error);
    return ticketError('Die Nachricht konnte nicht gespeichert werden.', 500);
  }
}
