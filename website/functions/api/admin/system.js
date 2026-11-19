import { requireAdmin } from '../../_shared/admin-auth.js';

export async function onRequestGet({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Administration storage is not configured.' }, { status: 503 });
  const auth = await requireAdmin(request, env, env.DB, '*');
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });
  const now = Math.floor(Date.now() / 1000);
  const health = await env.DB.prepare('SELECT COUNT(*) AS count FROM sqlite_master').first();
  const lastAudit = await env.DB.prepare('SELECT created_at FROM admin_audit_logs ORDER BY created_at DESC LIMIT 1').first();
  const lastTelemetry = await env.DB.prepare('SELECT received_at FROM telemetry_events ORDER BY received_at DESC LIMIT 1').first();
  return Response.json({
    ok: true,
    system: {
      backendStatus: 'online',
      databaseStatus: env.DB ? 'available' : 'unavailable',
      databaseObjects: health?.count ?? 0,
      lastDatabaseAudit: lastAudit?.created_at ?? null,
      lastTelemetryEvent: lastTelemetry?.received_at ?? null,
      sampledAt: now,
      hasPasswordHashSecret: Boolean(env.ADMIN_PASSWORD_HASH),
    },
  });
}
