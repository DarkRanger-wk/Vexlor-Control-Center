import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256Hex } from '../functions/_shared/admin-auth.js';
import { onRequestPost } from '../functions/api/users/presence.js';
import { onRequestGet as listUsers } from '../functions/api/admin/users.js';

const installId = '8e3f44d0-5ef5-4db4-b4b2-84ebd424aa9a';
const token = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

function presenceRequest({ name = 'Alex', bearer = token } = {}) {
  return new Request('https://infos-vcc.pages.dev/api/users/presence', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bearer}`,
      'X-VCC-Install-Id': installId,
      'X-VCC-Display-Name': name,
    },
    body: '{}',
  });
}

async function createPresenceDb() {
  const identity = {
    install_id: installId,
    token_hash: await sha256Hex(token),
    display_name: 'Alex',
  };
  let userBindings = null;
  const db = {
    get userBindings() { return userBindings; },
    prepare(sql) {
      return {
        bind(...bindings) {
          return {
            first: async () => sql.includes('FROM ticket_identities') && bindings[0] === installId ? identity : null,
            run: async () => {
              if (sql.includes('INSERT INTO users')) userBindings = bindings;
              return { success: true, meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };
  return db;
}

function createAdminRequest() {
  return new Request('https://infos-vcc.pages.dev/api/admin/users?limit=100&offset=100', {
    headers: { Cookie: 'vcc_admin_session=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
  });
}

async function createAdminDb() {
  const tokenHash = await sha256Hex('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
  const session = {
    id: 'admin-session',
    token_hash: tokenHash,
    admin_id: 'admin',
    role_id: 'super_admin',
    created_at: 1,
    expires_at: Math.floor(Date.now() / 1000) + 60,
    last_activity_at: Math.floor(Date.now() / 1000),
    revoked_at: null,
    display_name: 'Admin',
    admin_status: 'active',
  };
  const db = {
    prepare(sql) {
      return {
        bind(...bindings) {
          return {
            first: async () => {
              if (sql.includes('FROM admin_sessions s')) return session;
              if (sql.includes('FROM admin_roles')) return { name: 'Super Administrator' };
              if (sql.includes('FROM admin_permissions') && bindings[1] === 'users.read') return { permission: 'users.read' };
              if (sql.includes('COUNT(*) AS total FROM users')) return { total: 250 };
              return null;
            },
            all: async () => sql.includes('FROM users') ? {
              results: [{
                id: 'user-id',
                display_name: 'Alex',
                role: 'user',
                status: 'active',
                created_at: 10,
                last_active_at: Math.floor(Date.now() / 1000),
                online: 1,
              }],
            } : { results: [] },
            run: async () => ({ success: true, meta: { changes: 1 } }),
          };
        },
      };
    },
  };
  return db;
}

test('presence creates or refreshes the named user record using the installation identity', async () => {
  const db = await createPresenceDb();
  const response = await onRequestPost({ request: presenceRequest({ name: 'Alex Updated' }), env: { DB: db } });

  assert.equal(response.status, 200);
  assert.equal(db.userBindings[1], installId);
  assert.equal(db.userBindings[2], 'Alex Updated');
});

test('presence rejects a mismatched installation secret without creating a user', async () => {
  const db = await createPresenceDb();
  const response = await onRequestPost({ request: presenceRequest({ bearer: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' }), env: { DB: db } });

  assert.equal(response.status, 401);
  assert.equal(db.userBindings, null);
});

test('admin user list returns online state and the total for paginated results', async () => {
  const db = await createAdminDb();
  const response = await listUsers({ request: createAdminRequest(), env: { DB: db } });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.total, 250);
  assert.equal(body.offset, 100);
  assert.equal(body.users[0].display_name, 'Alex');
  assert.equal(body.users[0].online, true);
});
