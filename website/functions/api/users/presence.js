import { randomToken } from '../../_shared/admin-auth.js';
import { requireTicketIdentity, ticketError } from '../../_shared/tickets.js';

export async function onRequestPost({ request, env }) {
  const rawName = request.headers.get('x-vcc-display-name') ?? '';
  const displayName = rawName.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 24);
  if (!displayName) return ticketError('Bitte zuerst einen Anzeigenamen in der App festlegen.', 400);

  const auth = await requireTicketIdentity(request, env, true);
  if (auth.response) return auth.response;
  if (!auth.identity) return ticketError('Die lokale Identität konnte nicht geladen werden.', 401);

  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(`
    INSERT INTO users (id, install_id, display_name, role, status, created_at, last_active_at, updated_at)
    VALUES (?, ?, ?, 'user', 'active', ?, ?, ?)
    ON CONFLICT(install_id) DO UPDATE SET
      display_name = excluded.display_name,
      last_active_at = excluded.last_active_at,
      updated_at = excluded.updated_at
  `).bind(
    randomToken(16),
    auth.identity.installId,
    auth.identity.displayName || displayName,
    now,
    now,
    now,
  ).run();

  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
