import { randomToken } from '../_shared/admin-auth.js';

export async function onRequestPost({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Support storage is not configured.' }, { status: 503 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Ungültige Anfrage.' }, { status: 400 }); }
  const category = typeof body?.category === 'string' ? body.category.trim().slice(0, 64) : '';
  const subject = typeof body?.subject === 'string' ? body.subject.trim().slice(0, 160) : '';
  const text = typeof body?.body === 'string' ? body.body.trim().slice(0, 4000) : '';
  const allowed = ['Technische Probleme', 'Installation', 'Updates', 'Gaming-Funktionen', 'Premium', 'Sonstige Fragen'];
  if (!allowed.includes(category) || !subject || !text) return Response.json({ error: 'Kategorie, Betreff und Nachricht sind erforderlich.' }, { status: 400 });
  const userId = typeof body?.userId === 'string' ? body.userId.trim().slice(0, 128) : null;
  const installId = typeof body?.installId === 'string' ? body.installId.slice(0, 64) : null;
  const now = Math.floor(Date.now() / 1000);
  const id = randomToken(16);
  await env.DB.prepare(`
    INSERT INTO support_requests (id, user_id, install_id, category, priority, subject, body, status, internal_notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'normal', ?, ?, 'open', NULL, ?, ?)
  `).bind(id, userId, installId, category, subject, text, now, now).run();
  return Response.json({ ok: true, id });
}
