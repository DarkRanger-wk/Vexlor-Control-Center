import { requireAdmin } from '../../_shared/admin-auth.js';

export async function onRequestGet({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Administration storage is not configured.' }, { status: 503 });
  const auth = await requireAdmin(request, env, env.DB, 'stats.read');
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

  const now = Math.floor(Date.now() / 1000);
  const day = now - 86400;
  const [
    users,
    premium,
    codes,
    activeCodes,
    redemptions,
    sessions,
    activeSessions,
    installations,
    recentAudit,
    securityEvents,
  ] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS count FROM users').first(),
    env.DB.prepare(`SELECT COUNT(*) AS count FROM users WHERE premium_until IS NOT NULL AND premium_until >= ?`).bind(now).first(),
    env.DB.prepare('SELECT COUNT(*) AS count FROM redeem_codes').first(),
    env.DB.prepare(`SELECT COUNT(*) AS count FROM redeem_codes WHERE status = 'active' AND (expires_at IS NULL OR expires_at >= ?) AND current_redemptions < max_redemptions`).bind(now).first(),
    env.DB.prepare('SELECT COUNT(*) AS count FROM code_redemptions').first(),
    env.DB.prepare('SELECT COUNT(*) AS count FROM sessions').first(),
    env.DB.prepare('SELECT COUNT(*) AS count FROM sessions WHERE ended_at IS NULL AND last_heartbeat_at >= ?').bind(day).first(),
    env.DB.prepare('SELECT COUNT(*) AS count FROM installations').first(),
    env.DB.prepare('SELECT id, action, resource_type, resource_id, result, created_at FROM admin_audit_logs ORDER BY created_at DESC LIMIT 10').all(),
    env.DB.prepare('SELECT id, event_type, created_at FROM security_events ORDER BY created_at DESC LIMIT 10').all(),
  ]);

  return Response.json({
    ok: true,
    stats: {
      registeredUsers: users?.count ?? 0,
      premiumUsers: premium?.count ?? 0,
      createdCodes: codes?.count ?? 0,
      activeCodes: activeCodes?.count ?? 0,
      redeemedCodes: redemptions?.count ?? 0,
      appStarts: sessions?.count ?? 0,
      activeUsers: activeSessions?.count ?? 0,
      installations: installations?.count ?? 0,
    },
    recentAudit: recentAudit.results ?? [],
    recentSecurityEvents: securityEvents.results ?? [],
  });
}
