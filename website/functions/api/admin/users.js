import { audit, requireAdmin } from '../../_shared/admin-auth.js';

function validStatus(value) {
  return ['active', 'blocked', 'disabled'].includes(value);
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Administration storage is not configured.' }, { status: 503 });
  const auth = await requireAdmin(request, env, env.DB, 'users.read');
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

  const url = new URL(request.url);
  const search = String(url.searchParams.get('search') ?? '').trim();
  const status = String(url.searchParams.get('status') ?? '');
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 25)));
  let query = 'SELECT id, display_name, email, role, status, premium_until, created_at, last_active_at FROM users';
  const binds = [];
  const clauses = [];
  if (search) {
    clauses.push('(display_name LIKE ? OR email LIKE ? OR id LIKE ?)');
    const term = `%${search}%`;
    binds.push(term, term, term);
  }
  if (validStatus(status)) {
    clauses.push('status = ?');
    binds.push(status);
  }
  if (clauses.length) query += ` WHERE ${clauses.join(' AND ')}`;
  query += ' ORDER BY created_at DESC LIMIT ?';
  binds.push(limit);

  const users = await env.DB.prepare(query).bind(...binds).all();
  return Response.json({ ok: true, users: users.results ?? [] });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Administration storage is not configured.' }, { status: 503 });
  const auth = await requireAdmin(request, env, env.DB, 'users.manage');
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  }
  const id = typeof body?.id === 'string' ? body.id.trim() : '';
  const action = body?.action;
  if (!id || id.length > 128 || !['block', 'unblock', 'disable', 'setPremium', 'removePremium'].includes(action)) {
    return Response.json({ error: 'Ungültige Benutzeraktion.' }, { status: 400 });
  }
  const user = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
  if (!user) return Response.json({ error: 'Benutzer nicht gefunden.' }, { status: 404 });

  const now = Math.floor(Date.now() / 1000);
  let result;
  if (action === 'block') result = await env.DB.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?').bind('blocked', now, id).run();
  if (action === 'unblock') result = await env.DB.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?').bind('active', now, id).run();
  if (action === 'disable') result = await env.DB.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?').bind('disabled', now, id).run();
  if (action === 'setPremium') {
    const expiresAt = Number(body.expiresAt);
    if (!Number.isInteger(expiresAt) || expiresAt <= now) return Response.json({ error: 'Ungültiges Premium-Ablaufdatum.' }, { status: 400 });
    result = await env.DB.prepare('UPDATE users SET premium_until = ?, updated_at = ? WHERE id = ?').bind(expiresAt, now, id).run();
  }
  if (action === 'removePremium') result = await env.DB.prepare('UPDATE users SET premium_until = NULL, updated_at = ? WHERE id = ?').bind(now, id).run();

  await audit(env.DB, auth.admin.id, `user.${action}`, 'user', id, 'success');
  return Response.json({ ok: true, changes: result?.meta?.changes ?? 0 });
}
