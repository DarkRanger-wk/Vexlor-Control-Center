import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { onRequestGet, onRequestPost } from '../functions/api/arcade/profile.js';

const installId = '8e3f44d0-5ef5-4db4-b4b2-84ebd424aa9a';
const token = 'A'.repeat(43);
const tokenHash = createHash('sha256').update(token).digest('hex');
const profile = { roundsPlayed: 4, favorites: ['snake'] };

function createRequest(method, body) {
  return new Request('https://infos-vcc.pages.dev/api/arcade/profile', {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'X-VCC-Install-Id': installId,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function createDb(savedProfile = null) {
  const statements = [];
  return {
    statements,
    prepare(sql) {
      return {
        bind(...bindings) {
          statements.push({ sql, bindings });
          return {
            first: async () => {
              if (sql.includes('FROM ticket_identities')) {
                return { install_id: installId, token_hash: tokenHash, display_name: 'Nutzer' };
              }
              if (sql.includes('FROM arcade_profiles')) {
                return savedProfile ? { profile_json: JSON.stringify(savedProfile), updated_at: 123 } : null;
              }
              return null;
            },
            run: async () => ({ meta: { changes: 1 } }),
          };
        },
      };
    },
  };
}

test('arcade profile reads are scoped to the authenticated installation', async () => {
  const db = createDb(profile);
  const response = await onRequestGet({ request: createRequest('GET'), env: { DB: db } });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body.profile, profile);
  assert.equal(body.updatedAt, 123);
  assert.ok(db.statements.some((statement) =>
    statement.sql.includes('FROM arcade_profiles') && statement.bindings[0] === installId));
});

test('arcade profile writes bind the authenticated installation, not request data', async () => {
  const db = createDb();
  const response = await onRequestPost({
    request: createRequest('POST', { profile, installId: 'other-install' }),
    env: { DB: db },
  });
  const body = await response.json();
  const write = db.statements.find((statement) => statement.sql.includes('INSERT INTO arcade_profiles'));

  assert.equal(response.status, 200);
  assert.deepEqual(body.profile, profile);
  assert.equal(write.bindings[0], installId);
  assert.equal(write.bindings[1], JSON.stringify(profile));
});

test('arcade profile writes reject invalid profiles', async () => {
  const db = createDb();
  const response = await onRequestPost({
    request: createRequest('POST', { profile: [] }),
    env: { DB: db },
  });

  assert.equal(response.status, 400);
  assert.equal(db.statements.some((statement) => statement.sql.includes('INSERT INTO arcade_profiles')), false);
});
