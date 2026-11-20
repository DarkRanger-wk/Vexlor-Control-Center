import { randomToken } from '../../../_shared/admin-auth.js';
import {
  isTicketId,
  parseTicketAttachments,
  readTicketBody,
  requireTicketIdentity,
  ticketError,
  validateTicketText,
} from '../../../_shared/tickets.js';

export async function onRequestPost({ request, env, params }) {
  const auth = await requireTicketIdentity(request, env);
  if (auth.response) return auth.response;
  if (!auth.identity || !isTicketId(params.ticketId)) return ticketError('Ticket nicht gefunden.', 404);
  const parsed = await readTicketBody(request, 2 * 1024 * 1024);
  if (parsed.response) return parsed.response;
  const body = validateTicketText(parsed.body.body, 8000);
  if (!body) return ticketError('Eine Nachricht darf nicht leer sein.', 400);
  const attachmentsResult = parseTicketAttachments(parsed.body.attachments);
  if (attachmentsResult.response) return attachmentsResult.response;

  try {
    const ticket = await env.DB.prepare(`
      SELECT ticket_number, status FROM tickets WHERE id = ? AND install_id = ?
    `).bind(params.ticketId, auth.identity.installId).first();
    if (!ticket) return ticketError('Ticket nicht gefunden.', 404);
    if (ticket.status === 'closed') return ticketError('Ein geschlossenes Ticket kann nicht beantwortet werden.', 409);

    const now = Math.floor(Date.now() / 1000);
    const messageId = randomToken(16);
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO ticket_messages (id, ticket_number, author_type, author_id, is_internal, body, created_at)
        VALUES (?, ?, 'user', ?, 0, ?, ?)
      `).bind(messageId, ticket.ticket_number, auth.identity.installId, body, now),
      ...attachmentsResult.attachments.map((file) => env.DB.prepare(`
        INSERT INTO ticket_attachments
          (id, ticket_number, message_id, file_name, content_type, byte_size, content, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(file.id, ticket.ticket_number, messageId, file.fileName, file.contentType, file.bytes.byteLength, file.bytes, now)),
      env.DB.prepare(`
        UPDATE tickets
        SET status = CASE WHEN status IN ('waiting_user', 'resolved') THEN 'in_progress' ELSE status END,
            team_unread = 1, updated_at = ?, last_activity_at = ?
        WHERE ticket_number = ? AND install_id = ?
      `).bind(now, now, ticket.ticket_number, auth.identity.installId),
    ]);
    return Response.json({ ok: true, messageId }, { status: 201 });
  } catch (error) {
    console.error('Ticketantwort konnte nicht gespeichert werden:', error);
    return ticketError('Die Nachricht konnte nicht gespeichert werden.', 500);
  }
}
