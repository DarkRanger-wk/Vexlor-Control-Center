import { requireAdmin } from '../../_shared/admin-auth.js';
import { ticketError } from '../../_shared/tickets.js';

const ticketStatuses = new Set(['open', 'in_progress', 'waiting_user', 'resolved', 'closed']);
const ticketTypes = new Set(['bug', 'technical', 'question', 'feedback', 'other']);

export async function onRequestGet({ request, env }) {
  if (!env.DB) return ticketError('Die Ticket-Datenbank ist nicht konfiguriert.', 503);
  const auth = await requireAdmin(request, env, env.DB, 'support.read');
  if (auth.error) return ticketError(auth.error, auth.status);
  const manager = await requireAdmin(request, env, env.DB, 'support.manage');
  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? '';
  const type = url.searchParams.get('type') ?? '';
  const query = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
  const ticketNumberQuery = query.replace(/^VCC-/i, '');
  const assigned = url.searchParams.get('assigned') ?? '';
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 100) || 100));
  const clauses = [];
  const values = [];
  if (ticketStatuses.has(status)) {
    clauses.push('t.status = ?');
    values.push(status);
  }
  if (ticketTypes.has(type)) {
    clauses.push('t.type = ?');
    values.push(type);
  }
  if (query) {
    clauses.push("(printf('%05d', t.ticket_number) LIKE ? OR CAST(t.ticket_number AS TEXT) LIKE ? OR t.subject LIKE ? OR i.display_name LIKE ?)");
    const pattern = `%${query}%`;
    values.push(`%${ticketNumberQuery}%`, `%${ticketNumberQuery}%`, pattern, pattern);
  }
  if (assigned === 'mine') {
    clauses.push('t.assigned_admin_id = ?');
    values.push(auth.admin.id);
  } else if (assigned === 'unassigned') {
    clauses.push('t.assigned_admin_id IS NULL');
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  try {
    const [ticketsResult, assigneesResult, unreadResult] = await Promise.all([
      env.DB.prepare(`
        SELECT t.ticket_number, t.id, t.type, t.subject, t.priority, t.status,
          t.assigned_admin_id, t.user_unread, t.team_unread, t.created_at,
          t.updated_at, t.last_activity_at, i.display_name AS user_name,
          a.display_name AS assignee_name
        FROM tickets t
        JOIN ticket_identities i ON i.install_id = t.install_id
        LEFT JOIN admins a ON a.id = t.assigned_admin_id
        ${where}
        ORDER BY t.last_activity_at DESC
        LIMIT ?
      `).bind(...values, limit).all(),
      env.DB.prepare(`
        SELECT DISTINCT a.id, a.display_name
        FROM admins a
        WHERE a.status = 'active' AND (
          a.role_id = 'super_admin'
          OR (
            EXISTS (SELECT 1 FROM admin_permissions p WHERE p.role_id = a.role_id AND p.permission IN ('*', 'support.read'))
            AND EXISTS (SELECT 1 FROM admin_permissions p WHERE p.role_id = a.role_id AND p.permission IN ('*', 'support.manage'))
          )
        )
        ORDER BY a.display_name
      `).all(),
      env.DB.prepare('SELECT COALESCE(SUM(team_unread), 0) AS count FROM tickets').first(),
    ]);
    const tickets = ticketsResult.results ?? [];
    return Response.json({
      ok: true,
      canManage: !manager.error,
      tickets,
      assignees: assigneesResult.results ?? [],
      unreadCount: Number(unreadResult?.count ?? 0),
    });
  } catch (error) {
    console.error('Ticket-Postfach konnte nicht geladen werden:', error);
    return ticketError('Das Ticket-Postfach konnte nicht geladen werden.', 500);
  }
}
