import { getRequestIp, randomToken, securityEvent, sha256Hex } from '../../_shared/admin-auth.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[4-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function onRequestPost({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Code storage is not configured.' }, { status: 503 });
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  }
  const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase().slice(0, 128) : '';
  const installId = typeof body?.installId === 'string' ? body.installId : null;
  if (!code) return Response.json({ error: 'Bitte einen Code eingeben.' }, { status: 400 });
  if (!installId || !uuidPattern.test(installId)) return Response.json({ error: 'Ungültige Installationskennung.' }, { status: 400 });

  const codeHash = await sha256Hex(code);
  const now = Math.floor(Date.now() / 1000);
  const ipHash = await sha256Hex(getRequestIp(request));
  const recentAttempts = await env.DB.prepare(`
    SELECT COUNT(*) AS count
    FROM security_events
    WHERE event_type = 'code.redemption.attempt' AND ip_hash = ? AND created_at >= ?
  `).bind(ipHash, now - 15 * 60).first();
  if (Number(recentAttempts?.count ?? 0) >= 20) {
    return Response.json({ error: 'Zu viele Einlöseversuche. Bitte später erneut versuchen.' }, { status: 429 });
  }
  await securityEvent(env.DB, request, null, 'code.redemption.attempt');

  const record = await env.DB.prepare(`
    SELECT id, reward_type, reward_value, secret, status, expires_at, max_redemptions, current_redemptions
    FROM redeem_codes
    WHERE code_hash = ?
  `).bind(codeHash).first();
  if (!record) return Response.json({ error: 'Der Code ist ungültig.' }, { status: 404 });
  if (record.secret) return Response.json({ error: 'Der Code ist nicht öffentlich einlösbar.' }, { status: 403 });
  if (record.status === 'disabled') return Response.json({ error: 'Der Code wurde deaktiviert.' }, { status: 410 });
  if (record.status === 'expired' || (record.expires_at && record.expires_at <= now)) {
    await env.DB.prepare(`UPDATE redeem_codes SET status = 'expired', updated_at = ? WHERE id = ?`).bind(now, record.id).run();
    return Response.json({ error: 'Der Code ist abgelaufen.' }, { status: 410 });
  }
  if (record.status === 'redeemed' || record.current_redemptions >= record.max_redemptions) {
    return Response.json({ error: 'Das Einlösungslimit wurde erreicht.' }, { status: 409 });
  }

  const existing = await env.DB.prepare('SELECT id FROM code_redemptions WHERE code_id = ? AND install_id = ?')
    .bind(record.id, installId).first();
  if (existing) return Response.json({ error: 'Dieser Code wurde bereits von dieser Installation eingelöst.' }, { status: 409 });

  const durationSeconds = record.reward_type === 'premium' ? Number(record.reward_value) : null;
  if (record.reward_type === 'premium' && (!Number.isSafeInteger(durationSeconds) || durationSeconds <= 0)) {
    return Response.json({ error: 'Dieser Premium-Code ist nicht korrekt konfiguriert.' }, { status: 422 });
  }
  const userId = randomToken(16);
  const redemptionId = randomToken(16);
  const expiresAt = durationSeconds === null ? null : now + durationSeconds;
  const results = await env.DB.batch([
    env.DB.prepare(`
      INSERT OR IGNORE INTO users (id, install_id, display_name, role, status, created_at, updated_at)
      SELECT ?, ?, ?, 'user', 'active', ?, ?
      WHERE EXISTS (
        SELECT 1 FROM redeem_codes
        WHERE id = ? AND secret = 0 AND status = 'active'
          AND current_redemptions < max_redemptions
          AND (expires_at IS NULL OR expires_at > ?)
          AND NOT EXISTS (
            SELECT 1 FROM code_redemptions WHERE code_id = ? AND install_id = ?
          )
      )
    `).bind(userId, installId, `App-Installation ${installId.slice(0, 8)}`, now, now, record.id, now, record.id, installId),
    env.DB.prepare(`
      INSERT OR IGNORE INTO code_redemptions (id, code_id, user_id, install_id, reward_type, reward_value, redeemed_at)
      SELECT ?, codes.id, users.id, ?, codes.reward_type, codes.reward_value, ?
      FROM redeem_codes AS codes
      JOIN users ON users.install_id = ?
      WHERE codes.id = ? AND codes.secret = 0 AND codes.status = 'active'
        AND codes.current_redemptions < codes.max_redemptions
        AND (codes.expires_at IS NULL OR codes.expires_at > ?)
        AND NOT EXISTS (
          SELECT 1 FROM code_redemptions WHERE code_id = codes.id AND install_id = ?
        )
    `).bind(redemptionId, installId, now, installId, record.id, now, installId),
    env.DB.prepare(`
      UPDATE redeem_codes
      SET current_redemptions = current_redemptions + 1,
          status = CASE WHEN current_redemptions + 1 >= max_redemptions THEN 'redeemed' ELSE status END,
          updated_at = ?
      WHERE id = ? AND EXISTS (SELECT 1 FROM code_redemptions WHERE id = ?)
    `).bind(now, record.id, redemptionId),
    ...(expiresAt === null ? [] : [
      env.DB.prepare(`
        INSERT INTO premium_subscriptions (id, user_id, status, starts_at, expires_at, source, created_by, created_at)
        SELECT ?, user_id, 'active', ?, ?, 'code', NULL, ?
        FROM code_redemptions
        WHERE id = ? AND reward_type = 'premium'
      `).bind(randomToken(16), now, expiresAt, now, redemptionId),
      env.DB.prepare(`
        UPDATE users
        SET premium_until = MAX(COALESCE(premium_until, 0), ?), updated_at = ?
        WHERE id = (SELECT user_id FROM code_redemptions WHERE id = ? AND reward_type = 'premium')
      `).bind(expiresAt, now, redemptionId),
    ]),
  ]);

  if (!Number(results[1]?.meta?.changes ?? 0)) {
    const current = await env.DB.prepare(`
      SELECT status, expires_at, max_redemptions, current_redemptions
      FROM redeem_codes WHERE id = ?
    `).bind(record.id).first();
    if (current?.expires_at && current.expires_at <= now) {
      return Response.json({ error: 'Der Code ist abgelaufen.' }, { status: 410 });
    }
    if (current?.status === 'disabled') return Response.json({ error: 'Der Code wurde deaktiviert.' }, { status: 410 });
    if (current?.current_redemptions >= current?.max_redemptions) {
      return Response.json({ error: 'Das Einlösungslimit wurde erreicht.' }, { status: 409 });
    }
    return Response.json({ error: 'Dieser Code wurde bereits von dieser Installation eingelöst.' }, { status: 409 });
  }

  return Response.json({
    ok: true,
    reward: { type: record.reward_type, value: record.reward_value },
  });
}
