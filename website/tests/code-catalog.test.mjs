import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/codes.js';

test('public code catalogue exposes public status, reward and code values', async () => {
  let query = '';
  const db = {
    prepare(sql) {
      query = sql;
      return {
        bind(now) {
          assert.ok(Number.isInteger(now));
          return {
            all: async () => ({
              results: [{
                id: 'public-id',
                code_name: 'Launch reward',
                public_code: 'LAUNCH-CODE-0001',
                reward_type: 'badge',
                reward_value: 'founder',
                description: 'A public reward',
                expires_at: null,
                max_redemptions: 100,
                current_redemptions: 2,
                public_status: 'active',
              }],
            }),
          };
        },
      };
    },
  };
  const response = await onRequestGet({ env: { DB: db } });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.match(query, /status = 'expired'/);
  assert.match(query, /status = 'redeemed'/);
  assert.match(query, /WHERE status != 'disabled'/);
  assert.deepEqual(body.codes[0], {
    id: 'public-id',
    name: 'Launch reward',
    code: 'LAUNCH-CODE-0001',
    rewardType: 'badge',
    rewardValue: 'founder',
    description: 'A public reward',
    expiresAt: null,
    remaining: 98,
    status: 'active',
  });
});
