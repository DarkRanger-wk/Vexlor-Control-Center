const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[4-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedEvents = new Set(['app.started', 'app.stopped', 'session.started', 'heartbeat', 'session.ended', 'consent.revoked']);
const maxEventsPerInstallPerMinute = 90;

function isUuid(value) {
  return typeof value === 'string' && uuidPattern.test(value);
}

async function applyEvent(db, event, now) {
  const { installId, eventId, eventType, sessionId, appVersion, platform } = event;
  const existing = await db.prepare('SELECT event_id FROM events WHERE event_id = ?').bind(eventId).first();
  if (existing) return { ok: true, duplicate: true };

  const rate = await db.prepare(`
    SELECT COUNT(*) AS count FROM events WHERE install_id = ? AND received_at >= ?
  `).bind(installId, now - 60).first();
  if (Number(rate?.count ?? 0) >= maxEventsPerInstallPerMinute) {
    return { error: 'Rate limit exceeded.' };
  }

  await db.prepare(`
    INSERT INTO installations (install_id, first_seen_at, last_seen_at, app_version, platform)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(install_id) DO UPDATE SET last_seen_at = excluded.last_seen_at,
      app_version = excluded.app_version, platform = excluded.platform
  `).bind(installId, now, now, appVersion, platform).run();

  const dedupe = await db.prepare(`
    INSERT INTO events (event_id, install_id, event_type, received_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(event_id) DO NOTHING
  `).bind(eventId, installId, eventType, now).run();
  if (dedupe.meta.changes === 0) return { ok: true, duplicate: true };

  if (eventType === 'session.started') {
    await db.prepare(`
      INSERT INTO sessions (session_id, install_id, started_at, last_heartbeat_at, duration_seconds)
      VALUES (?, ?, ?, ?, 0)
      ON CONFLICT(session_id) DO NOTHING
    `).bind(sessionId, installId, now, now).run();
  } else if (eventType === 'heartbeat') {
    await db.prepare(`
      UPDATE sessions
      SET duration_seconds = duration_seconds + MIN(MAX(?, last_heartbeat_at), last_heartbeat_at + 180) - last_heartbeat_at,
          last_heartbeat_at = MAX(?, last_heartbeat_at)
      WHERE session_id = ? AND install_id = ? AND ended_at IS NULL
    `).bind(now, now, sessionId, installId).run();
  } else if (eventType === 'session.ended') {
    await db.prepare(`
      UPDATE sessions
      SET duration_seconds = duration_seconds + MIN(MAX(?, last_heartbeat_at), last_heartbeat_at + 180) - last_heartbeat_at,
          last_heartbeat_at = MAX(?, last_heartbeat_at),
          ended_at = MAX(?, last_heartbeat_at)
      WHERE session_id = ? AND install_id = ? AND ended_at IS NULL
    `).bind(now, now, now, sessionId, installId).run();
  }

  await db.prepare(`DELETE FROM events WHERE received_at < ?`).bind(now - 30 * 86400).run();
  return { ok: true };
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Statistics storage is not configured.' }, { status: 503 });
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 4096) return Response.json({ error: 'Request is too large.' }, { status: 413 });

  let event;
  try {
    const body = await request.text();
    if (body.length > 4096) return Response.json({ error: 'Request is too large.' }, { status: 413 });
    event = JSON.parse(body);
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (typeof event !== 'object' || event === null || Array.isArray(event)) {
    return Response.json({ error: 'Invalid telemetry event.' }, { status: 400 });
  }

  const { installId, eventId, eventType, sessionId, appVersion, platform } = event;
  if (!isUuid(installId) || !isUuid(eventId) || !allowedEvents.has(eventType)
    || typeof appVersion !== 'string' || appVersion.length > 32
    || platform !== 'win32') {
    return Response.json({ error: 'Invalid telemetry event.' }, { status: 400 });
  }

  if (eventType.startsWith('session.') || eventType === 'heartbeat') {
    if (!isUuid(sessionId)) return Response.json({ error: 'Invalid session ID.' }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  try {
    if (eventType === 'consent.revoked') {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM events WHERE install_id = ?').bind(installId),
        env.DB.prepare('DELETE FROM sessions WHERE install_id = ?').bind(installId),
        env.DB.prepare('DELETE FROM installations WHERE install_id = ?').bind(installId),
      ]);
      return Response.json({ ok: true, deleted: true });
    }

    const result = await applyEvent(env.DB, event, now);
    if (result.error) return Response.json({ error: result.error }, { status: 429 });
    return Response.json(result);
  } catch (error) {
    console.error('Telemetry event failed:', error);
    return Response.json({ error: 'Telemetry event could not be saved.' }, { status: 500 });
  }
}
