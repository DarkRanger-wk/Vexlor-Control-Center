import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearSessionCookie,
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
