import { audit, requireAdmin } from '../../_shared/admin-auth.js';

export async function onRequestGet({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Administration storage is not configured.' }, { status: 503 });
  const auth = await requireAdmin(request, env, env.DB, 'support.read');
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });
  const url = new URL(request.url);
  const status = String(url.searchParams.get('status') ?? '');
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 25)));
  const bind = status && ['open', 'in_progress', 'resolved', 'closed'].includes(status)
    ? env.DB.prepare(`
        SELECT * FROM support_requests WHERE status = ? ORDER BY created_at DESC LIMIT ?
      `).bind(status, limit)
    : env.DB.prepare('SELECT * FROM support_requests ORDER BY created_at DESC LIMIT ?').bind(limit);
  const rows = await bind.all();
  return Response.json({ ok: true, requests: rows.results ?? [] });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Administration storage is not configured.' }, { status: 503 });
  const auth = await requireAdmin(request, env, env.DB, 'support.manage');
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Ungültige Anfrage.' }, { status: 400 }); }
  const id = typeof body?.id === 'string' ? body.id.slice(0, 128) : '';
  if (!id) return Response.json({ error: 'Ungültige Anfrage-ID.' }, { status: 400 });
  const status = ['open', 'in_progress', 'resolved', 'closed'].includes(body.status) ? body.status : null;
  const priority = ['low', 'normal', 'high', 'critical'].includes(body.priority) ? body.priority : null;
  const notes = typeof body.internalNotes === 'string' ? body.internalNotes.slice(0, 4000) : null;
  if (!status && !priority && notes === null) return Response.json({ error: 'Keine Änderung angegeben.' }, { status: 400 });
  const now = Math.floor(Date.now() / 1000);
  const updates = [];
  const values = [];
  if (status) { updates.push('status = ?'); values.push(status); }
  if (priority) { updates.push('priority = ?'); values.push(priority); }
  if (notes !== null) { updates.push('internal_notes = ?'); values.push(notes); }
  updates.push('updated_at = ?'); values.push(now); values.push(id);
  await env.DB.prepare(`UPDATE support_requests SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
  await audit(env.DB, auth.admin.id, 'support.updated', 'support_request', id, 'success');
  return Response.json({ ok: true });
}
