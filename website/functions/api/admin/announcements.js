import { audit, randomToken, requireAdmin } from '../../_shared/admin-auth.js';

export async function onRequestGet({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Administration storage is not configured.' }, { status: 503 });
  const auth = await requireAdmin(request, env, env.DB, 'announcements.manage');
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });
  const rows = await env.DB.prepare('SELECT * FROM announcements ORDER BY created_at DESC LIMIT 100').all();
  return Response.json({ ok: true, announcements: rows.results ?? [] });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Administration storage is not configured.' }, { status: 503 });
  const auth = await requireAdmin(request, env, env.DB, 'announcements.manage');
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Ungültige Anfrage.' }, { status: 400 }); }
  const action = body?.action;
  const id = typeof body?.id === 'string' ? body.id : null;
  const now = Math.floor(Date.now() / 1000);
  if (action === 'delete') {
    if (!id) return Response.json({ error: 'Ungültige Ankündigungs-ID.' }, { status: 400 });
    await env.DB.prepare('DELETE FROM announcements WHERE id = ?').bind(id).run();
    await audit(env.DB, auth.admin.id, 'announcement.deleted', 'announcement', id, 'success');
    return Response.json({ ok: true });
  }
  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 120) : '';
  const text = typeof body?.body === 'string' ? body.body.trim().slice(0, 4000) : '';
  const kind = ['info', 'warning', 'maintenance', 'feature'].includes(body?.kind) ? body.kind : 'info';
  if (!title || !text) return Response.json({ error: 'Titel und Nachricht sind erforderlich.' }, { status: 400 });
  const active = body?.active === false ? 0 : 1;
  const startsAt = body?.startsAt == null ? null : Number(body.startsAt);
  const expiresAt = body?.expiresAt == null ? null : Number(body.expiresAt);
  if (action === 'update' && id) {
    await env.DB.prepare(`
      UPDATE announcements
      SET title = ?, body = ?, kind = ?, active = ?, starts_at = ?, expires_at = ?, updated_at = ?
      WHERE id = ?
    `).bind(title, text, kind, active, startsAt, expiresAt, now, id).run();
    await audit(env.DB, auth.admin.id, 'announcement.updated', 'announcement', id, 'success');
  } else {
    const announcementId = randomToken(16);
    await env.DB.prepare(`
      INSERT INTO announcements (id, title, body, kind, active, starts_at, expires_at, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(announcementId, title, text, kind, active, startsAt, expiresAt, auth.admin.id, now, now).run();
    await audit(env.DB, auth.admin.id, 'announcement.published', 'announcement', announcementId, 'success');
  }
  return Response.json({ ok: true });
}
