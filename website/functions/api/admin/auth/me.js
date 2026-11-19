import { clearSessionCookie, requireAdmin, securityEvent } from '../../../_shared/admin-auth.js';

export async function onRequestGet({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Administration storage is not configured.' }, { status: 503 });
  const auth = await requireAdmin(request, env, env.DB, '*');
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });
  return Response.json({ ok: true, admin: auth.admin });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Administration storage is not configured.' }, { status: 503 });
  const auth = await requireAdmin(request, env, env.DB, '*');
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare('UPDATE admin_sessions SET revoked_at = ? WHERE id = ?')
    .bind(now, auth.sessionId).run();
  await securityEvent(env.DB, request, auth.admin.id, 'logout');
  return Response.json({ ok: true }, {
    headers: { 'Set-Cookie': clearSessionCookie(), 'Cache-Control': 'no-store' },
  });
}
