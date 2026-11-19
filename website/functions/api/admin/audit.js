import { requireAdmin } from '../../_shared/admin-auth.js';

export async function onRequestGet({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Administration storage is not configured.' }, { status: 503 });
  const auth = await requireAdmin(request, env, env.DB, 'audit.read');
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });
  const url = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? 50)));
  const rows = await env.DB.prepare(`
    SELECT l.*, a.display_name
    FROM admin_audit_logs l
    LEFT JOIN admins a ON a.id = l.admin_id
    ORDER BY l.created_at DESC LIMIT ?
  `).bind(limit).all();
  return Response.json({ ok: true, audit: rows.results ?? [] });
}
