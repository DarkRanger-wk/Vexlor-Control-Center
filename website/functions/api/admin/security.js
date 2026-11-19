import { requireAdmin } from '../../_shared/admin-auth.js';

export async function onRequestGet({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Administration storage is not configured.' }, { status: 503 });
  const auth = await requireAdmin(request, env, env.DB, '*');
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });
  const url = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? 50)));
  const events = await env.DB.prepare(`
    SELECT id, admin_id, event_type, created_at
    FROM security_events
    ORDER BY created_at DESC LIMIT ?
  `).bind(limit).all();
  const failedLogins = await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM security_events
    WHERE event_type = 'login.failed'
  `).first();
  return Response.json({ ok: true, failedLogins: failedLogins?.count ?? 0, events: events.results ?? [] });
}
