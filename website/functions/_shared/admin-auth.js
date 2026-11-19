import { argon2idAsync } from '@noble/hashes/argon2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

const SESSION_COOKIE = 'vcc_admin_session';
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const IDLE_TTL_SECONDS = 30 * 60;
const HASH_REGEX = /^argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/=]+)\$([A-Za-z0-9+/=]+)$/;

function utf8(value) {
  return new TextEncoder().encode(value);
}

function base64Encode(bytes) {
  let result = '';
  for (const byte of bytes) result += String.fromCharCode(byte);
  return btoa(result);
}

function base64Decode(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left[index] ^ right[index];
  }
  return result === 0;
}

export function createAdminPasswordHash(password, options = {}) {
  if (typeof password !== 'string' || password.length < 12) {
    throw new Error('Das Administrator-Passwort muss mindestens 12 Zeichen lang sein.');
  }
  const memory = options.memory ?? 19456;
  const time = options.time ?? 2;
  const parallelism = options.parallelism ?? 1;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = argon2idAsync(utf8(password), salt, {
    m: memory,
    t: time,
    p: parallelism,
    dkLen: 32,
  });
  return hash.then((derived) => [
    'argon2id',
    'v=19',
    `m=${memory},t=${time},p=${parallelism}`,
    base64Encode(salt),
    base64Encode(derived),
  ].join('$'));
}

export async function verifyAdminPassword(password, encodedHash) {
  if (typeof password !== 'string' || typeof encodedHash !== 'string') return false;
  const match = HASH_REGEX.exec(encodedHash);
  if (!match) return false;
  const memory = Number(match[1]);
  const time = Number(match[2]);
  const parallelism = Number(match[3]);
  if (!Number.isInteger(memory) || memory < 8192 || memory > 65536
    || !Number.isInteger(time) || time < 1 || time > 10
    || !Number.isInteger(parallelism) || parallelism < 1 || parallelism > 4) return false;
  const salt = base64Decode(match[4]);
  const expected = base64Decode(match[5]);
  const derived = await argon2idAsync(utf8(password), salt, {
    m: memory,
    t: time,
    p: parallelism,
    dkLen: expected.length,
  });
  return constantTimeEqual(derived, expected);
}

export function getRequestIp(request) {
  return request.headers.get('CF-Connecting-IP')
    || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
    || 'unknown';
}

export async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', utf8(value));
  return bytesToHex(new Uint8Array(digest));
}

export function randomToken(bytes = 32) {
  return base64Encode(crypto.getRandomValues(new Uint8Array(bytes)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

export function parseCookies(cookieHeader) {
  const result = {};
  for (const entry of String(cookieHeader ?? '').split(';')) {
    const separator = entry.indexOf('=');
    if (separator < 0) continue;
    const key = entry.slice(0, separator).trim();
    result[key] = decodeURIComponent(entry.slice(separator + 1).trim());
  }
  return result;
}

export function sessionCookie(token, expiresAt) {
  const maxAge = Math.max(0, expiresAt - Math.floor(Date.now() / 1000));
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=${maxAge}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=0`;
}

export async function ensureBootstrapAdmin(db, env) {
  if (!env.ADMIN_PASSWORD_HASH) return null;
  const now = Math.floor(Date.now() / 1000);
  await db.prepare(`
    INSERT OR IGNORE INTO admins (id, display_name, role_id, password_hash, status, failed_attempts, locked_until, created_at, updated_at)
    VALUES (?, ?, 'super_admin', 'env:argon2id', 'active', 0, NULL, ?, ?)
  `).bind('bootstrap-super-admin', 'Super Administrator', now, now).run();
  return db.prepare('SELECT * FROM admins WHERE id = ?').bind('bootstrap-super-admin').first();
}

export async function createAdminSession(db, request, admin, env) {
  const now = Math.floor(Date.now() / 1000);
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const ipHash = await sha256Hex(getRequestIp(request));
  const userAgentHash = await sha256Hex(request.headers.get('user-agent') ?? 'unknown');
  const expiresAt = now + SESSION_TTL_SECONDS;
  const id = randomToken(16);
  await db.prepare(`
    INSERT INTO admin_sessions
      (id, token_hash, admin_id, role_id, created_at, expires_at, last_activity_at, revoked_at, ip_hash, user_agent_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
  `).bind(id, tokenHash, admin.id, admin.role_id, now, expiresAt, now, ipHash, userAgentHash).run();
  return { token, expiresAt };
}

export async function requireAdmin(request, env, db, permission = '*') {
  const cookies = parseCookies(request.headers.get('cookie'));
  const token = cookies[SESSION_COOKIE];
  if (!token) return { error: 'Nicht angemeldet.', status: 401 };
  const tokenHash = await sha256Hex(token);
  const now = Math.floor(Date.now() / 1000);
  const session = await db.prepare(`
    SELECT s.*, a.display_name, a.status AS admin_status
    FROM admin_sessions s
    JOIN admins a ON a.id = s.admin_id
    WHERE s.token_hash = ? AND s.revoked_at IS NULL
  `).bind(tokenHash).first();
  if (!session) return { error: 'Ungültige Sitzung.', status: 401 };
  if (session.expires_at <= now || session.last_activity_at + IDLE_TTL_SECONDS <= now) {
    await db.prepare('UPDATE admin_sessions SET revoked_at = ? WHERE id = ?').bind(now, session.id).run();
    return { error: 'Sitzung abgelaufen.', status: 401 };
  }
  if (session.admin_status !== 'active') return { error: 'Administratorkonto ist nicht aktiv.', status: 403 };

  const role = await db.prepare('SELECT name FROM admin_roles WHERE id = ?').bind(session.role_id).first();
  if (!role) return { error: 'Rolle nicht gefunden.', status: 403 };
  if (permission !== '*') {
    const wildcard = await db.prepare('SELECT 1 FROM admin_permissions WHERE role_id = ? AND permission = ?').bind(session.role_id, '*').first();
    const granted = wildcard || await db.prepare('SELECT 1 FROM admin_permissions WHERE role_id = ? AND permission = ?').bind(session.role_id, permission).first();
    if (!granted) return { error: 'Keine Berechtigung für diese Aktion.', status: 403 };
  }

  await db.prepare('UPDATE admin_sessions SET last_activity_at = ? WHERE id = ?').bind(now, session.id).run();
  return {
    admin: { id: session.admin_id, displayName: session.display_name, roleId: session.role_id, roleName: role.name },
    sessionId: session.id,
  };
}

export async function audit(db, adminId, action, resourceType, resourceId, result, details = null) {
  const now = Math.floor(Date.now() / 1000);
  await db.prepare(`
    INSERT INTO admin_audit_logs (id, admin_id, action, resource_type, resource_id, result, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(randomToken(16), adminId, action, resourceType, resourceId, result, details, now).run();
}

export async function securityEvent(db, request, adminId, eventType, details = null) {
  const now = Math.floor(Date.now() / 1000);
  await db.prepare(`
    INSERT INTO security_events (id, admin_id, event_type, ip_hash, user_agent_hash, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    randomToken(16),
    adminId,
    eventType,
    await sha256Hex(getRequestIp(request)),
    await sha256Hex(request.headers.get('user-agent') ?? 'unknown'),
    details,
    now,
  ).run();
}
