import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/_middleware.js';

test('admin API does not expose credentialed CORS access', async () => {
  const response = await onRequest({
    request: new Request('https://infos-vcc.pages.dev/api/admin/auth/me'),
    next: async () => Response.json({ ok: true }),
  });

  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('admin preflight does not grant cross-origin access', async () => {
  const response = await onRequest({
    request: new Request('https://infos-vcc.pages.dev/api/admin/auth/login', { method: 'OPTIONS' }),
    next: async () => { throw new Error('Preflight must not reach the handler.'); },
  });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
});

test('public APIs retain their existing cross-origin access', async () => {
  const response = await onRequest({
    request: new Request('https://infos-vcc.pages.dev/api/features'),
    next: async () => Response.json({ ok: true }),
  });

  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
});
