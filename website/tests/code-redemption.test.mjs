import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { onRequestPost } from '../functions/api/codes/redeem.js';

const installId = '8e3f44d0-5ef5-4db4-b4b2-84ebd424aa9a';
const ticketToken = 'T'.repeat(43);
const ticketTokenHash = createHash('sha256').update(ticketToken).digest('hex');

function createDb({ redemptionChanges = 1, currentRedemptions = 0, ticketIdentity = true } = {}) {
  const statements = [];
  let batchCalled = false;
  const record = {
    id: 'code-id',
    code_name: 'Test',
    reward_type: 'badge',
    reward_value: 'tester',
    status: 'active',
    expires_at: null,
    max_redemptions: 1,
    current_redemptions: 0,
  };
  const db = {
    statements,
    get batchCalled() { return batchCalled; },
    prepare(sql) {
      return {
        bind(...bindings) {
          const statement = { sql, bindings };
          statements.push(statement);
          return {
            first: async () => {
              if (sql.includes('COUNT(*) AS count')) return { count: 0 };
              if (sql.includes('FROM ticket_identities')) {
                return ticketIdentity ? {
                  install_id: installId,
                  token_hash: ticketTokenHash,
                  display_name: 'Testnutzer',
                } : null;
              }
              if (sql.includes('SELECT id, code_name, reward_type')) return record;
              if (sql.includes('SELECT id, premium_until FROM users')) return null;
              if (sql.includes('SELECT id FROM code_redemptions')) return null;
              if (sql.includes('SELECT status, expires_at')) {
                return { ...record, current_redemptions: currentRedemptions };
              }
              return null;
            },
            run: async () => ({ success: true }),
          };
        },
      };
    },
    async batch(preparedStatements) {
      batchCalled = true;
      statements.push(...preparedStatements.filter((statement) => !statements.includes(statement)));
      return preparedStatements.map((_statement, index) => ({ meta: { changes: index === 1 ? redemptionChanges : 1 } }));
    },
  };
  return db;
}

function createRequest(body) {
  return new Request('https://infos-vcc.pages.dev/api/codes/redeem', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '192.0.2.10',
      Authorization: `Bearer ${ticketToken}`,
      'X-VCC-Install-Id': installId,
      'X-VCC-Display-Name': 'Testnutzer',
    },
    body: JSON.stringify(body),
  });
}

test('redemption requires the secure installation identity, not body-supplied identifiers', async () => {
  const db = createDb({ ticketIdentity: false });
  const response = await onRequestPost({
    request: createRequest({ code: 'TEST-CODE', installId, userId: 'spoofed-user' }),
    env: { DB: db },
  });

  assert.equal(response.status, 401);
  assert.equal(db.batchCalled, false);
});

test('redemption derives the user record server-side and conditionally updates code limits', async () => {
  const db = createDb();
  const response = await onRequestPost({
    request: createRequest({ code: 'TEST-CODE', installId: 'spoofed-install', userId: 'spoofed-user' }),
    env: { DB: db },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    reward: { type: 'badge', value: 'tester', name: 'tester' },
  });

  const userInsert = db.statements.find((statement) => statement.sql.includes('INSERT OR IGNORE INTO users'));
  const redemptionInsert = db.statements.find((statement) => statement.sql.includes('INSERT OR IGNORE INTO code_redemptions'));
  const codeUpdate = db.statements.find((statement) => statement.sql.includes('UPDATE redeem_codes'));
  assert.ok(userInsert);
  assert.ok(redemptionInsert);
  assert.ok(codeUpdate);
  assert.equal(userInsert.bindings.includes('spoofed-user'), false);
  assert.equal(userInsert.bindings.includes('spoofed-install'), false);
  assert.equal(userInsert.bindings.includes(installId), true);
  assert.equal(redemptionInsert.bindings.includes('spoofed-user'), false);
  assert.equal(redemptionInsert.bindings.includes('spoofed-install'), false);
  assert.match(redemptionInsert.sql, /current_redemptions < codes\.max_redemptions/);
  assert.match(codeUpdate.sql, /EXISTS \(SELECT 1 FROM code_redemptions WHERE id = \?\)/);
});

test('a concurrent redemption that loses the limit race is not reported as successful', async () => {
  const db = createDb({ redemptionChanges: 0, currentRedemptions: 1 });
  const response = await onRequestPost({
    request: createRequest({ code: 'TEST-CODE' }),
    env: { DB: db },
  });

  assert.equal(response.status, 409);
  assert.equal((await response.json()).ok, undefined);
});
