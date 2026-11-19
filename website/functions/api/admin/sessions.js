import { audit, requireAdmin } from '../../_shared/admin-auth.js';

export async function onRequestGet({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Administration storage is not configured.' }, { status: 503 });
  const auth = await requireAdmin(request, env, env.DB, '*');
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });
  const rows = await env.DB.prepare(`
    SELECT s.id, s.admin_id, s.role_id, s.created_at, s.expires_at, s.last_activity_at, s.revoked_at,
           a.display_name
    FROM admin_sessions s
    JOIN admins a ON a.id = s.admin_id
    ORDER BY s.created_at DESC LIMIT 100
  `).all();
  return Response.json({ ok: true, sessions: rows.results ?? [] });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Administration storage is not configured.' }, { status: 503 });
  const auth = await requireAdmin(request, env, env.DB, '*');
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Ungültige Anfrage.' }, { status: 400 }); }
  const id = typeof body?.id === 'string' ? body.id.trim().slice(0, 128) : '';
  if (!id) return Response.json({ error: 'Ungültige Sitzungs-ID.' }, { status: 400 });
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare('UPDATE admin_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL')
    .bind(now, id).run();
  await audit(env.DB, auth.admin.id, 'session.revoked', 'admin_session', id, 'success');
  return Response.json({ ok: true });
}
