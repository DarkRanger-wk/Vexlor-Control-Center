export async function onRequestGet({ env }) {
  if (!env.DB) return Response.json({ active: [], notice: 'Administration storage is not configured.' }, { status: 503 });
  const now = Math.floor(Date.now() / 1000);
  const rows = await env.DB.prepare(`
    SELECT id, title, body, kind, starts_at, expires_at, created_at
    FROM announcements
    WHERE active = 1
      AND (starts_at IS NULL OR starts_at <= ?)
      AND (expires_at IS NULL OR expires_at > ?)
    ORDER BY created_at DESC LIMIT 20
  `).bind(now, now).all();
  return Response.json({ ok: true, announcements: rows.results ?? [] });
}
