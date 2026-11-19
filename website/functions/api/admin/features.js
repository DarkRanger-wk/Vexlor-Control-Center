import { audit, requireAdmin } from '../../_shared/admin-auth.js';

export async function onRequestGet({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Administration storage is not configured.' }, { status: 503 });
  const auth = await requireAdmin(request, env, env.DB, 'features.manage');
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });
  const rows = await env.DB.prepare('SELECT * FROM feature_flags ORDER BY name ASC').all();
  return Response.json({ ok: true, features: rows.results ?? [] });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Administration storage is not configured.' }, { status: 503 });
  const auth = await requireAdmin(request, env, env.DB, 'features.manage');
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Ungültige Anfrage.' }, { status: 400 }); }
  const key = typeof body?.key === 'string' ? body.key.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 64) : '';
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 120) : '';
  if (!key || !name) return Response.json({ error: 'Feature-Key und Name sind erforderlich.' }, { status: 400 });
  const description = typeof body.description === 'string' ? body.description.slice(0, 1000) : null;
  const enabled = body.enabled === true ? 1 : 0;
  const beta = body.beta === true ? 1 : 0;
  const config = body.config && typeof body.config === 'object' ? JSON.stringify(body.config).slice(0, 4000) : null;
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(`
    INSERT INTO feature_flags (key, name, description, enabled, beta, config, updated_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET name = excluded.name, description = excluded.description,
      enabled = excluded.enabled, beta = excluded.beta, config = excluded.config,
      updated_by = excluded.updated_by, updated_at = excluded.updated_at
  `).bind(key, name, description, enabled, beta, config, auth.admin.id, now).run();
  await audit(env.DB, auth.admin.id, enabled ? 'feature.enabled' : 'feature.disabled', 'feature', key, 'success');
  return Response.json({ ok: true });
}
