import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/codes/redeem.js';

const installId = '8e3f44d0-5ef5-4db4-b4b2-84ebd424aa9a';

function createDb({ redemptionChanges = 1, currentRedemptions = 0 } = {}) {
  const statements = [];
  let batchCalled = false;
  const record = {
    id: 'code-id',
    reward_type: 'badge',
    reward_value: null,
    secret: 0,
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
              if (sql.includes('SELECT id, reward_type, reward_value')) return record;
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
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.10' },
    body: JSON.stringify(body),
  });
}

test('redemption requires an installation id, not a client-supplied user id', async () => {
  const db = createDb();
  const response = await onRequestPost({
    request: createRequest({ code: 'TEST-CODE', userId: 'spoofed-user' }),
    env: { DB: db },
  });

  assert.equal(response.status, 400);
  assert.equal(db.batchCalled, false);
});

test('redemption derives the user record server-side and conditionally updates code limits', async () => {
  const db = createDb();
  const response = await onRequestPost({
    request: createRequest({ code: 'TEST-CODE', installId, userId: 'spoofed-user' }),
    env: { DB: db },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    reward: { type: 'badge', value: null },
  });

  const userInsert = db.statements.find((statement) => statement.sql.includes('INSERT OR IGNORE INTO users'));
  const redemptionInsert = db.statements.find((statement) => statement.sql.includes('INSERT OR IGNORE INTO code_redemptions'));
  const codeUpdate = db.statements.find((statement) => statement.sql.includes('UPDATE redeem_codes'));
  assert.ok(userInsert);
  assert.ok(redemptionInsert);
  assert.ok(codeUpdate);
  assert.equal(userInsert.bindings.includes('spoofed-user'), false);
  assert.equal(redemptionInsert.bindings.includes('spoofed-user'), false);
  assert.match(redemptionInsert.sql, /current_redemptions < codes\.max_redemptions/);
  assert.match(codeUpdate.sql, /EXISTS \(SELECT 1 FROM code_redemptions WHERE id = \?\)/);
});

test('a concurrent redemption that loses the limit race is not reported as successful', async () => {
  const db = createDb({ redemptionChanges: 0, currentRedemptions: 1 });
  const response = await onRequestPost({
    request: createRequest({ code: 'TEST-CODE', installId }),
    env: { DB: db },
  });

  assert.equal(response.status, 409);
  assert.equal((await response.json()).ok, undefined);
});
