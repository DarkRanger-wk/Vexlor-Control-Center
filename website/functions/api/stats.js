const periodOptions = {
  day: { modifier: '-7 days', group: '%Y-%m-%d', limit: 7 },
  week: { modifier: '-8 weeks', group: '%Y-%W', limit: 8 },
  month: { modifier: '-12 months', group: '%Y-%m', limit: 12 },
};

export async function onRequestGet({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Statistics storage is not configured.' }, { status: 503 });

  const period = new URL(request.url).searchParams.get('period') || 'day';
  const options = periodOptions[period];
  if (!options) return Response.json({ error: 'Invalid period.' }, { status: 400 });

  try {
    const now = Math.floor(Date.now() / 1000);
    const activeSince = now - 15 * 60;
    const dayStart = Math.floor(Date.now() / 86400000) * 86400;
    const stats = await env.DB.prepare(`
      SELECT
        (SELECT COUNT(*) FROM installations) AS totalInstallations,
        (SELECT COUNT(*) FROM installations WHERE last_seen_at >= ?) AS activeUsers,
        (SELECT COUNT(DISTINCT install_id) FROM installations WHERE last_seen_at >= ?) AS usersToday,
        (SELECT COUNT(DISTINCT install_id) FROM sessions WHERE ended_at IS NULL AND last_heartbeat_at >= ?) AS currentUsers,
        (SELECT COALESCE(ROUND(AVG(duration_seconds) / 60.0, 1), 0) FROM sessions WHERE ended_at IS NOT NULL AND started_at >= ?) AS avgSessionMinutes,
        (SELECT COALESCE(ROUND(SUM(duration_seconds) / 3600.0, 2), 0) FROM sessions) AS totalTrackedHours,
        (SELECT COALESCE(MAX(last_seen_at), 0) FROM installations) AS lastUpdated,
        (SELECT COALESCE(ROUND(SUM(duration_seconds) / 60.0 / 30.0 / NULLIF(COUNT(DISTINCT install_id), 0), 1), 0)
         FROM sessions WHERE started_at >= ?) AS avgDailyUsageMinutes
    `).bind(activeSince, activeSince, now - 180, now - 30 * 86400, now - 30 * 86400).first();

    const series = await env.DB.prepare(`
      SELECT strftime(?, started_at, 'unixepoch') AS label,
        COUNT(*) AS sessions,
        COALESCE(SUM(duration_seconds), 0) AS durationSeconds
      FROM sessions
      WHERE started_at >= unixepoch('now', ?)
      GROUP BY label
      ORDER BY label
      LIMIT ?
    `).bind(options.group, options.modifier, options.limit).all();

    const totalInstallations = Number(stats?.totalInstallations ?? 0);
    return Response.json({
      totalInstallations,
      activeUsers: Number(stats?.activeUsers ?? 0),
      currentUsers: Number(stats?.currentUsers ?? 0),
      usersToday: Number(stats?.usersToday ?? 0),
      avgDailyUsageMinutes: Number(stats?.avgDailyUsageMinutes ?? 0),
      avgSessionMinutes: Number(stats?.avgSessionMinutes ?? 0),
      avgUsagePerUserMinutes: Number(stats?.avgDailyUsageMinutes ?? 0),
      totalTrackedHours: Number(stats?.totalTrackedHours ?? 0),
      lastUpdated: Number(stats?.lastUpdated ?? 0) > 0
        ? new Date(Number(stats.lastUpdated) * 1000).toISOString()
        : null,
      isReady: totalInstallations > 0,
      period,
      series: (series.results ?? []).map((item) => ({
        label: item.label,
        sessions: Number(item.sessions),
        durationMinutes: Math.round(Number(item.durationSeconds) / 60),
      })),
    });
  } catch (error) {
    console.error('Stats query failed:', error);
    return Response.json({ error: 'Unable to load statistics.' }, { status: 500 });
  }
}
