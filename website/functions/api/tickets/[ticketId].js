import { isTicketId, loadTicketMessages, requireTicketIdentity, ticketError } from '../../_shared/tickets.js';

export async function onRequestGet({ request, env, params }) {
  const auth = await requireTicketIdentity(request, env);
  if (auth.response) return auth.response;
  if (!auth.identity || !isTicketId(params.ticketId)) return ticketError('Ticket nicht gefunden.', 404);
  try {
    const ticket = await env.DB.prepare(`
      SELECT ticket_number, id, type, subject, priority, status, form_data, created_at, updated_at, last_activity_at
      FROM tickets WHERE id = ? AND install_id = ?
    `).bind(params.ticketId, auth.identity.installId).first();
    if (!ticket) return ticketError('Ticket nicht gefunden.', 404);
    await env.DB.prepare('UPDATE tickets SET user_unread = 0 WHERE ticket_number = ?')
      .bind(ticket.ticket_number).run();
    return Response.json({
      ok: true,
      ticket: {
        ...ticket,
        formData: JSON.parse(ticket.form_data || '{}'),
        messages: await loadTicketMessages(env.DB, ticket.ticket_number, false),
      },
    });
  } catch (error) {
    console.error('Ticket konnte nicht geladen werden:', error);
    return ticketError('Ticket konnte nicht geladen werden.', 500);
  }
}
