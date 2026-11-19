import { audit, requireAdmin } from '../../_shared/admin-auth.js';

export async function onRequestGet({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Administration storage is not configured.' }, { status: 503 });
  const auth = await requireAdmin(request, env, env.DB, '*');
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });
  const rows = await env.DB.prepare('SELECT * FROM app_settings ORDER BY key ASC').all();
  return Response.json({ ok: true, settings: rows.results ?? [] });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Administration storage is not configured.' }, { status: 503 });
  const auth = await requireAdmin(request, env, env.DB, '*');
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Ungültige Anfrage.' }, { status: 400 }); }
  const key = typeof body?.key === 'string' ? body.key.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 64) : '';
  if (!key) return Response.json({ error: 'Ungültiger Einstellungsschlüssel.' }, { status: 400 });
  const value = body?.value;
  if (value === undefined) return Response.json({ error: 'Einstellungswert fehlt.' }, { status: 400 });
  const serialized = typeof value === 'string' ? value.slice(0, 4000) : JSON.stringify(value).slice(0, 4000);
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(`
    INSERT INTO app_settings (key, value, updated_by, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value,
      updated_by = excluded.updated_by, updated_at = excluded.updated_at
  `).bind(key, serialized, auth.admin.id, now).run();
  await audit(env.DB, auth.admin.id, 'app_setting.changed', 'app_setting', key, 'success');
  return Response.json({ ok: true });
}
