import { requireAdmin } from '../../_shared/admin-auth.js';

export async function onRequestGet({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Administration storage is not configured.' }, { status: 503 });
  const auth = await requireAdmin(request, env, env.DB, 'stats.read');
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

  const now = Math.floor(Date.now() / 1000);
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
    env.DB.prepare('SELECT COUNT(*) AS count FROM users WHERE last_active_at >= ?').bind(now - 120).first(),
    env.DB.prepare('SELECT COUNT(*) AS count FROM installations').first(),
    env.DB.prepare('SELECT id, action, resource_type, resource_id, result, created_at FROM admin_audit_logs ORDER BY created_at DESC LIMIT 10').all(),
    env.DB.prepare('SELECT id, event_type, created_at FROM security_events ORDER BY created_at DESC LIMIT 10').all(),
  ]);

  let downloadStats = null;
  let downloadError = null;
  try {
    let total = 0;
    let page = 1;
    let releases;
    do {
      const response = await fetch(`https://api.github.com/repos/DarkRanger-wk/Vexlor-Control-Center/releases?per_page=100&page=${page}`, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'Vexlor-Control-Center-admin',
        },
        signal: AbortSignal.timeout(8000),
        cf: { cacheTtl: 300 },
      });
      if (!response.ok) {
        downloadError = `GitHub lieferte HTTP ${response.status}.`;
        break;
      }
      releases = await response.json();
      if (!Array.isArray(releases)) {
        downloadError = 'GitHub lieferte ein ungültiges Release-Format.';
        break;
      }
      for (const release of releases) {
        for (const asset of Array.isArray(release.assets) ? release.assets : []) {
          if (Number.isSafeInteger(asset.download_count) && asset.download_count >= 0) {
            total += asset.download_count;
          }
        }
      }
      page += 1;
    } while (releases.length === 100 && page <= 10);
    if (!downloadError) downloadStats = total;
  } catch (error) {
    console.error('GitHub-Downloadzahlen konnten nicht geladen werden:', error);
    downloadError = 'GitHub-Downloadzahlen konnten nicht geladen werden.';
  }

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
      githubDownloads: downloadStats,
    },
    downloadsError: downloadError,
    recentAudit: recentAudit.results ?? [],
    recentSecurityEvents: securityEvents.results ?? [],
  });
}
