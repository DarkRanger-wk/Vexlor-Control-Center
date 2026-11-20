import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { onRequestPost } from '../functions/api/admin/codes.js';

const sessionToken = 'test-admin-session';
const sessionHash = createHash('sha256').update(sessionToken).digest('hex');
const publicCode = 'COLOR-REWARD-0001';

function createDb() {
  const statements = [];
  let batchCalled = false;
  return {
    statements,
    get batchCalled() { return batchCalled; },
    prepare(sql) {
      return {
        bind(...bindings) {
          statements.push({ sql, bindings });
          return {
            first: async () => {
              if (sql.includes('FROM admin_sessions s')) {
                return {
                  id: 'session-id',
                  admin_id: 'owner-id',
                  role_id: 'super_admin',
                  token_hash: sessionHash,
                  expires_at: Math.floor(Date.now() / 1000) + 3600,
                  last_activity_at: Math.floor(Date.now() / 1000),
                  revoked_at: null,
                  admin_status: 'active',
                  display_name: 'Owner',
                };
              }
              if (sql.includes('SELECT name FROM admin_roles')) return { name: 'Super Administrator' };
              if (sql.includes('SELECT 1 FROM admin_permissions')) return { allowed: 1 };
              if (sql.includes('SELECT id FROM redeem_codes WHERE code_hash')) return null;
              return null;
            },
            run: async () => ({ meta: { changes: 1 } }),
          };
        },
      };
    },
    async batch(preparedStatements) {
      batchCalled = true;
      statements.push(...preparedStatements.filter((statement) => !statements.includes(statement)));
      return preparedStatements.map(() => ({ meta: { changes: 1 } }));
    },
  };
}

test('code creation stores a normal public code and ignores the legacy secret flag', async () => {
  const db = createDb();
  const request = new Request('https://infos-vcc.pages.dev/api/admin/codes', {
    method: 'POST',
    headers: {
      Cookie: `vcc_admin_session=${sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'create',
      name: 'Community color',
      code: publicCode,
      reward: { type: 'profile_color', value: '#428BFF' },
      maxRedemptions: 100,
      secret: true,
    }),
  });
  const response = await onRequestPost({ request, env: { DB: db } });
  const body = await response.json();
  const insert = db.statements.find((statement) => statement.sql.includes('INSERT INTO redeem_codes'));

  assert.equal(response.status, 200);
  assert.equal(body.codes[0].code, publicCode);
  assert.equal(body.codes[0].name, 'Community color');
  assert.ok(insert);
  assert.match(insert.sql, /public_code/);
  assert.doesNotMatch(insert.sql, /\bsecret\b/);
  assert.equal(insert.bindings.includes(publicCode), true);
  assert.equal(db.batchCalled, true);
});
