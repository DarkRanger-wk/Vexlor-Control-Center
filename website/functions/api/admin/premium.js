import { audit, randomToken, requireAdmin } from '../../_shared/admin-auth.js';

export async function onRequestGet({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Administration storage is not configured.' }, { status: 503 });
  const auth = await requireAdmin(request, env, env.DB, 'premium.manage');
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });
  const rows = await env.DB.prepare(`
    SELECT p.*, u.display_name, u.email
    FROM premium_subscriptions p
    LEFT JOIN users u ON u.id = p.user_id
    ORDER BY p.created_at DESC LIMIT 100
  `).all();
  return Response.json({ ok: true, subscriptions: rows.results ?? [] });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Administration storage is not configured.' }, { status: 503 });
  const auth = await requireAdmin(request, env, env.DB, 'premium.manage');
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Ungültige Anfrage.' }, { status: 400 }); }
  const userId = typeof body?.userId === 'string' ? body.userId.trim().slice(0, 128) : '';
  if (!userId) return Response.json({ error: 'Ungültige Benutzer-ID.' }, { status: 400 });
  const user = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first();
  if (!user) return Response.json({ error: 'Benutzer nicht gefunden.' }, { status: 404 });
  const now = Math.floor(Date.now() / 1000);

  if (body.action === 'remove') {
    await env.DB.batch([
      env.DB.prepare('UPDATE premium_subscriptions SET status = ?, expires_at = ? WHERE user_id = ? AND status = ?')
        .bind('removed', now, userId, 'active'),
      env.DB.prepare('UPDATE users SET premium_until = NULL, updated_at = ? WHERE id = ?').bind(now, userId),
    ]);
    await audit(env.DB, auth.admin.id, 'premium.removed', 'user', userId, 'success');
    return Response.json({ ok: true });
  }

  const expiresAt = Number(body.expiresAt);
  if (!Number.isInteger(expiresAt) || expiresAt <= now) return Response.json({ error: 'Ungültiges Ablaufdatum.' }, { status: 400 });
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO premium_subscriptions (id, user_id, status, starts_at, expires_at, source, created_by, created_at)
      VALUES (?, ?, 'active', ?, ?, 'admin', ?, ?)
    `).bind(randomToken(16), userId, now, expiresAt, auth.admin.id, now),
    env.DB.prepare('UPDATE users SET premium_until = ?, updated_at = ? WHERE id = ?').bind(expiresAt, now, userId),
  ]);
  await audit(env.DB, auth.admin.id, 'premium.granted', 'user', userId, 'success');
  return Response.json({ ok: true });
}
