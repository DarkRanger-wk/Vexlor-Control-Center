import {
  clearSessionCookie,
  createAdminSession,
  ensureBootstrapAdmin,
  getRequestIp,
  securityEvent,
  sessionCookie,
  sha256Hex,
  verifyAdminPassword,
} from '../../../_shared/admin-auth.js';

export async function onRequestPost({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Administration storage is not configured.' }, { status: 503 });
  if (!env.ADMIN_PASSWORD_HASH) return Response.json({ error: 'Administrator authentication is not configured.' }, { status: 503 });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  }
  if (typeof body?.password !== 'string' || body.password.length > 1024) {
    return Response.json({ error: 'Bitte ein gültiges Passwort eingeben.' }, { status: 400 });
  }

  const db = env.DB;
  const admin = await ensureBootstrapAdmin(db, env);
  if (!admin) return Response.json({ error: 'Administrator ist nicht verfügbar.' }, { status: 503 });
  const now = Math.floor(Date.now() / 1000);
  if (admin.locked_until && admin.locked_until > now) {
    await securityEvent(db, request, admin.id, 'login.locked');
    return Response.json({ error: 'Das Konto ist vorübergehend gesperrt.' }, { status: 429 });
  }

  const ipHash = await sha256Hex(getRequestIp(request));
  const windowStart = now - 15 * 60;
  const recentFailures = await db.prepare(`
    SELECT COUNT(*) AS count
    FROM security_events
    WHERE event_type = 'login.failed' AND ip_hash = ? AND created_at >= ?
  `).bind(ipHash, windowStart).first();
  if (Number(recentFailures?.count ?? 0) >= 10) {
    await securityEvent(db, request, admin.id, 'login.rate_limited');
    return Response.json({ error: 'Zu viele fehlgeschlagene Anmeldeversuche. Bitte später erneut versuchen.' }, { status: 429 });
  }

  const valid = await verifyAdminPassword(body.password, env.ADMIN_PASSWORD_HASH);
  if (!valid) {
    const failedAttempts = Number(admin.failed_attempts ?? 0) + 1;
    const lockedUntil = failedAttempts >= 5 ? now + 15 * 60 : null;
    await db.batch([
      db.prepare('UPDATE admins SET failed_attempts = ?, locked_until = ?, updated_at = ? WHERE id = ?')
        .bind(failedAttempts, lockedUntil, now, admin.id),
    ]);
    await securityEvent(db, request, admin.id, 'login.failed');
    return Response.json({
      error: failedAttempts >= 5
        ? 'Zu viele Fehlversuche. Der Zugang ist 15 Minuten gesperrt.'
        : 'Passwort ist nicht korrekt.',
    }, { status: 401 });
  }

  await db.prepare('UPDATE admins SET failed_attempts = 0, locked_until = NULL, updated_at = ? WHERE id = ?')
    .bind(now, admin.id).run();
  await securityEvent(db, request, admin.id, 'login.success');
  const session = await createAdminSession(db, request, admin, env);

  return Response.json({
    ok: true,
    admin: { id: admin.id, displayName: admin.display_name, roleId: admin.role_id, roleName: 'Super Administrator' },
  }, {
    headers: {
      'Set-Cookie': sessionCookie(session.token, session.expiresAt),
      'Cache-Control': 'no-store',
    },
  });
}
