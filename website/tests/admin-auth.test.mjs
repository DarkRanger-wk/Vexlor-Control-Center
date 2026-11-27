import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearSessionCookie,
  createAdminSession,
  createAdminPasswordHash,
  randomToken,
  sessionCookie,
  sha256Hex,
  verifyAdminPassword,
} from '../functions/_shared/admin-auth.js';

test('Argon2id hash verifies only the matching password', async () => {
  const hash = await createAdminPasswordHash('EinSehrSicheresTestpasswort!2026', {
    memory: 8192,
    time: 1,
    parallelism: 1,
  });
  assert.match(hash, /^argon2id\$v=19\$m=/);
  assert.equal(await verifyAdminPassword('EinSehrSicheresTestpasswort!2026', hash), true);
  assert.equal(await verifyAdminPassword('FalschesPasswort', hash), false);
});

test('random tokens and session cookies use secure cookie attributes', async () => {
  const token = randomToken();
  assert.ok(token.length >= 32);
  assert.match(sessionCookie(token, Math.floor(Date.now() / 1000) + 3600), /HttpOnly; Secure; SameSite=Strict/);
  assert.match(clearSessionCookie(), /Max-Age=0/);
  assert.match(await sha256Hex('test'), /^[a-f0-9]{64}$/);
});

test('admin sessions remain valid for ten years unless explicitly revoked', async () => {
  let inserted;
  const db = {
    prepare() {
      return {
        bind(...values) {
          inserted = values;
          return { run: async () => ({ success: true }) };
        },
      };
    },
  };
  const createdAt = Math.floor(Date.now() / 1000);
  const session = await createAdminSession(
    db,
    new Request('https://infos-vcc.pages.dev/api/admin/auth/login', { headers: { 'User-Agent': 'test' } }),
    { id: 'admin-id', role_id: 'super_admin' },
    {},
  );

  assert.equal(session.expiresAt, inserted[5]);
  assert.ok(session.expiresAt >= createdAt + 10 * 365 * 24 * 60 * 60);
});
