import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { onRequestGet, onRequestPost } from '../functions/api/codes/rewards.js';

const installId = '8e3f44d0-5ef5-4db4-b4b2-84ebd424aa9a';
const token = 'R'.repeat(43);
const tokenHash = createHash('sha256').update(token).digest('hex');

function createRequest(method, body) {
  return new Request('https://infos-vcc.pages.dev/api/codes/rewards', {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'X-VCC-Install-Id': installId,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function createDb() {
  let batchCalled = false;
  const statements = [];
  return {
    statements,
    get batchCalled() { return batchCalled; },
    prepare(sql) {
      return {
        bind(...bindings) {
          statements.push({ sql, bindings });
          return {
            first: async () => {
              if (sql.includes('FROM ticket_identities')) {
                return { install_id: installId, token_hash: tokenHash, display_name: 'Nutzer' };
              }
              if (sql.includes('SELECT id, premium_until FROM users')) {
                return { id: 'user-id', premium_until: 123456 };
              }
              if (sql.includes('FROM user_rewards WHERE id = ? AND user_id = ?')) return null;
              return null;
            },
            all: async () => ({
              results: [{
                id: 'reward-id',
                reward_type: 'profile_color',
                reward_value: '#428BFF',
                display_name: 'Blue color',
                equipped: 1,
                created_at: 123,
              }],
            }),
            run: async () => ({ meta: { changes: 1 } }),
          };
        },
      };
    },
    async batch(statementsToRun) {
      batchCalled = true;
      return statementsToRun.map(() => ({ meta: { changes: 1 } }));
    },
  };
}

test('reward inventory is bound to the authenticated installation owner', async () => {
  const db = createDb();
  const response = await onRequestGet({ request: createRequest('GET'), env: { DB: db } });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.rewards[0].id, 'reward-id');
  assert.equal(body.premiumUntil, 123456);
  assert.ok(db.statements.some((statement) =>
    statement.sql.includes('FROM user_rewards') && statement.bindings.includes('user-id')));
});

test('an installation cannot equip a reward owned by another user', async () => {
  const db = createDb();
  const response = await onRequestPost({
    request: createRequest('POST', { action: 'equip', rewardId: 'other-user-reward' }),
    env: { DB: db },
  });

  assert.equal(response.status, 404);
  assert.equal(db.batchCalled, false);
});
