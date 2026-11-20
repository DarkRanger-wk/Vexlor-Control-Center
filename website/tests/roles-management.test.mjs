import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256Hex } from '../functions/_shared/admin-auth.js';
import { onRequestPost } from '../functions/api/admin/roles.js';

const sessionToken = 'test-admin-session';

function createDb() {
  const statements = [];
  let batchCalled = false;
  const sessionHashPromise = sha256Hex(sessionToken);
  return {
    statements,
    get batchCalled() { return batchCalled; },
    prepare(sql) {
      return {
        bind(...bindings) {
          const statement = { sql, bindings };
          statements.push(statement);
          return {
            first: async () => {
              if (sql.includes('FROM admin_sessions s')) {
                return {
                  id: 'session-id',
                  admin_id: 'owner-id',
                  role_id: 'super_admin',
                  expires_at: Math.floor(Date.now() / 1000) + 3600,
                  last_activity_at: Math.floor(Date.now() / 1000),
                  revoked_at: null,
                  admin_status: 'active',
                  display_name: 'Owner',
                  token_hash: await sessionHashPromise,
                };
              }
              if (sql.includes('SELECT name FROM admin_roles')) return { name: 'Super Administrator' };
              if (sql.includes('lower(name) = lower(?)')) return null;
              return { id: bindings[0] };
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

function createRequest(body) {
  return new Request('https://infos-vcc.pages.dev/api/admin/roles', {
    method: 'POST',
    headers: {
      Cookie: `vcc_admin_session=${sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

test('super administrators can create custom roles with allowlisted permissions', async () => {
  const db = createDb();
  const response = await onRequestPost({
    request: createRequest({
      action: 'create',
      name: 'Support Team',
      description: 'Handles support requests',
      permissions: ['support.read', 'support.manage'],
    }),
    env: { DB: db },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.match(body.roleId, /^custom-support-team-/);
  assert.equal(db.batchCalled, true);
  assert.ok(db.statements.some((statement) => statement.sql.includes('INSERT INTO admin_roles')));
  assert.ok(db.statements.some((statement) => statement.bindings?.includes('support.read')));
  assert.ok(db.statements.some((statement) => statement.bindings?.includes('support.manage')));
});

test('custom roles cannot grant wildcard privileges', async () => {
  const db = createDb();
  const response = await onRequestPost({
    request: createRequest({
      action: 'create',
      name: 'Overpowered',
      description: 'Invalid role',
      permissions: ['*'],
    }),
    env: { DB: db },
  });

  assert.equal(response.status, 400);
  assert.equal(db.batchCalled, false);
});
