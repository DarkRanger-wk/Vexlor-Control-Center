import { audit, requireAdmin } from '../../_shared/admin-auth.js';

export async function onRequestGet({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Administration storage is not configured.' }, { status: 503 });
  const auth = await requireAdmin(request, env, env.DB, '*');
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });
  const now = Math.floor(Date.now() / 1000);
  const [
    users,
    codes,
    redemptions,
    premium,
    userRewards,
    announcements,
    appSettings,
    features,
    support,
    bugs,
    feedback,
  ] = await Promise.all([
    env.DB.prepare(`
      SELECT id, display_name, email, role, status, premium_until, created_at, last_active_at, updated_at
      FROM users
    `).all(),
    env.DB.prepare(`
      SELECT id, code_hint, code_name, public_code, reward_type, reward_value, description, status, expires_at,
             max_redemptions, current_redemptions, created_at, updated_at
      FROM redeem_codes
    `).all(),
    env.DB.prepare('SELECT id, code_id, user_id, install_id, reward_type, reward_value, redeemed_at FROM code_redemptions').all(),
    env.DB.prepare('SELECT * FROM premium_subscriptions').all(),
    env.DB.prepare('SELECT * FROM user_rewards').all(),
    env.DB.prepare('SELECT * FROM announcements').all(),
    env.DB.prepare('SELECT * FROM app_settings').all(),
    env.DB.prepare('SELECT * FROM feature_flags').all(),
    env.DB.prepare('SELECT id, user_id, install_id, category, priority, subject, body, status, created_at, updated_at FROM support_requests').all(),
    env.DB.prepare('SELECT id, user_id, install_id, summary, details, status, created_at, updated_at FROM bug_reports').all(),
    env.DB.prepare('SELECT id, user_id, install_id, category, message, status, created_at, updated_at FROM user_feedback').all(),
  ]);
  await audit(env.DB, auth.admin.id, 'backup.exported', 'database', null, 'success');
  return Response.json({
    format: 'vexlor-admin-backup',
    version: 1,
    exportedAt: now,
    excluded: ['admin password hashes', 'admin session tokens', 'security IP data'],
    data: {
      users: users.results ?? [],
      codes: codes.results ?? [],
      redemptions: redemptions.results ?? [],
      premium: premium.results ?? [],
      userRewards: userRewards.results ?? [],
      announcements: announcements.results ?? [],
      appSettings: appSettings.results ?? [],
      features: features.results ?? [],
      support: support.results ?? [],
      bugs: bugs.results ?? [],
      feedback: feedback.results ?? [],
    },
  }, {
    headers: {
      'Content-Disposition': `attachment; filename="vexlor-admin-backup-${now}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
