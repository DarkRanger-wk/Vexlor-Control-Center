import { audit, requireAdmin } from '../../../_shared/admin-auth.js';
import { isTicketId, loadTicketMessages, readTicketBody, ticketError } from '../../../_shared/tickets.js';

const ticketStatuses = new Set(['open', 'in_progress', 'waiting_user', 'resolved', 'closed']);
const ticketPriorities = new Set(['low', 'normal', 'high', 'critical']);

export async function onRequestGet({ request, env, params }) {
  if (!env.DB) return ticketError('Die Ticket-Datenbank ist nicht konfiguriert.', 503);
  const auth = await requireAdmin(request, env, env.DB, 'support.read');
  if (auth.error) return ticketError(auth.error, auth.status);
  if (!isTicketId(params.ticketId)) return ticketError('Ticket nicht gefunden.', 404);
  try {
    const ticket = await env.DB.prepare(`
      SELECT t.ticket_number, t.id, t.type, t.subject, t.priority, t.status, t.form_data,
        t.assigned_admin_id, t.created_at, t.updated_at, t.last_activity_at,
        i.install_id, i.display_name AS user_name, i.created_at AS user_created_at,
        a.display_name AS assignee_name
      FROM tickets t
      JOIN ticket_identities i ON i.install_id = t.install_id
      LEFT JOIN admins a ON a.id = t.assigned_admin_id
      WHERE t.id = ?
    `).bind(params.ticketId).first();
    if (!ticket) return ticketError('Ticket nicht gefunden.', 404);
    const manager = await requireAdmin(request, env, env.DB, 'support.manage');
    return Response.json({
      ok: true,
      canManage: !manager.error,
      ticket: {
        ...ticket,
        formData: JSON.parse(ticket.form_data || '{}'),
        messages: await loadTicketMessages(env.DB, ticket.ticket_number, true),
      },
    });
  } catch (error) {
    console.error('Admin-Ticket konnte nicht geladen werden:', error);
    return ticketError('Ticket konnte nicht geladen werden.', 500);
  }
}

export async function onRequestPost({ request, env, params }) {
  if (!env.DB) return ticketError('Die Ticket-Datenbank ist nicht konfiguriert.', 503);
  const parsed = await readTicketBody(request, 16384);
  if (parsed.response) return parsed.response;
  const body = parsed.body;
  const action = body.action;
  const permission = action === 'mark-read' ? 'support.read' : 'support.manage';
  const auth = await requireAdmin(request, env, env.DB, permission);
  if (auth.error) return ticketError(auth.error, auth.status);
  if (!isTicketId(params.ticketId)) return ticketError('Ticket nicht gefunden.', 404);

  const ticket = await env.DB.prepare('SELECT ticket_number FROM tickets WHERE id = ?')
    .bind(params.ticketId).first();
  if (!ticket) return ticketError('Ticket nicht gefunden.', 404);
  const now = Math.floor(Date.now() / 1000);
  try {
    if (action === 'mark-read') {
      await env.DB.prepare('UPDATE tickets SET team_unread = 0 WHERE ticket_number = ?')
        .bind(ticket.ticket_number).run();
      return Response.json({ ok: true });
    }

    if (action === 'status') {
      if (!ticketStatuses.has(body.status)) return ticketError('Ungültiger Ticketstatus.', 400);
      await env.DB.prepare('UPDATE tickets SET status = ?, updated_at = ?, last_activity_at = ? WHERE ticket_number = ?')
        .bind(body.status, now, now, ticket.ticket_number).run();
    } else if (action === 'priority') {
      if (!ticketPriorities.has(body.priority)) return ticketError('Ungültige Priorität.', 400);
      await env.DB.prepare('UPDATE tickets SET priority = ?, updated_at = ?, last_activity_at = ? WHERE ticket_number = ?')
        .bind(body.priority, now, now, ticket.ticket_number).run();
    } else if (action === 'assign') {
      const assigneeId = body.assigneeId === null ? null : typeof body.assigneeId === 'string' ? body.assigneeId.slice(0, 128) : '';
      if (assigneeId === '') return ticketError('Ungültiges Teammitglied.', 400);
      if (assigneeId !== null) {
        const eligible = await env.DB.prepare(`
          SELECT a.id FROM admins a
          WHERE a.id = ? AND a.status = 'active'
            AND (
              a.role_id = 'super_admin'
              OR (
                EXISTS (SELECT 1 FROM admin_permissions p WHERE p.role_id = a.role_id AND p.permission IN ('*', 'support.read'))
                AND EXISTS (SELECT 1 FROM admin_permissions p WHERE p.role_id = a.role_id AND p.permission IN ('*', 'support.manage'))
              )
            )
        `).bind(assigneeId).first();
        if (!eligible) return ticketError('Das Teammitglied darf keine Tickets bearbeiten.', 400);
      }
      await env.DB.prepare(`
        UPDATE tickets
        SET assigned_admin_id = ?, team_unread = 1, updated_at = ?, last_activity_at = ?
        WHERE ticket_number = ?
      `).bind(assigneeId, now, now, ticket.ticket_number).run();
    } else {
      return ticketError('Unbekannte Ticketaktion.', 400);
    }
    await audit(env.DB, auth.admin.id, `ticket.${action}`, 'ticket', params.ticketId, 'success');
    return Response.json({ ok: true });
  } catch (error) {
    console.error('Ticketänderung fehlgeschlagen:', error);
    return ticketError('Die Ticketänderung konnte nicht gespeichert werden.', 500);
  }
}
