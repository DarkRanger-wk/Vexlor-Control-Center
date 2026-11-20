import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256Hex } from '../functions/_shared/admin-auth.js';
import { parseTicketAttachments } from '../functions/_shared/tickets.js';
import { onRequestGet as getUserTicket } from '../functions/api/tickets/[ticketId].js';

const installId = '8e3f44d0-5ef5-4db4-b4b2-84ebd424aa9a';
const otherInstallId = '35781dc0-b437-4c33-9ef5-a2dff582f30d';
const token = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const ticketId = 'abcdefghijklmnopqrstuv';

function createRequest(id = installId, bearer = token) {
  return new Request(`https://infos-vcc.pages.dev/api/tickets/${ticketId}`, {
    headers: {
      Authorization: `Bearer ${bearer}`,
      'X-VCC-Install-Id': id,
    },
  });
}

async function createDb() {
  const identity = {
    install_id: installId,
    token_hash: await sha256Hex(token),
    display_name: 'Testperson',
  };
  const ticket = {
    ticket_number: 1,
    id: ticketId,
    type: 'bug',
    subject: 'Testfehler',
    priority: 'normal',
    status: 'open',
    form_data: '{}',
    created_at: 1,
    updated_at: 1,
    last_activity_at: 1,
  };
  const messages = [
    { id: 'public-message', author_type: 'team', author_id: 'support', is_internal: 0, body: 'Öffentliche Antwort', created_at: 1 },
    { id: 'private-message', author_type: 'team', author_id: 'support', is_internal: 1, body: 'Interne Notiz', created_at: 2 },
  ];
  const db = {
    prepare(sql) {
      return {
        bind(...bindings) {
          return {
            first: async () => {
              if (sql.includes('FROM ticket_identities')) {
                return bindings[0] === installId ? identity : null;
              }
              if (sql.includes('FROM tickets WHERE id = ? AND install_id = ?')) {
                return bindings[0] === ticketId && bindings[1] === installId ? ticket : null;
              }
              return null;
            },
            all: async () => {
              if (sql.includes('FROM ticket_messages')) {
                return { results: sql.includes('AND is_internal = 0') ? messages.filter((message) => !message.is_internal) : messages };
              }
              if (sql.includes('FROM ticket_attachments')) {
                const files = [
                  { id: 'public-file', message_id: 'public-message', file_name: 'public.txt', content_type: 'text/plain', byte_size: 1, content: new Uint8Array([65]) },
                  { id: 'private-file', message_id: 'private-message', file_name: 'private.txt', content_type: 'text/plain', byte_size: 1, content: new Uint8Array([66]) },
                ];
                return { results: sql.includes('AND m.is_internal = 0') ? files.filter((file) => file.message_id === 'public-message') : files };
              }
              return { results: [] };
            },
            run: async () => ({ success: true, meta: { changes: 1 } }),
          };
        },
      };
    },
  };
  return db;
}

test('a ticket owner receives public messages and attachments but never internal notes', async () => {
  const response = await getUserTicket({
    request: createRequest(),
    env: { DB: await createDb() },
    params: { ticketId },
  });

  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.ticket.messages.length, 1);
  assert.equal(result.ticket.messages[0].body, 'Öffentliche Antwort');
  assert.equal(result.ticket.messages[0].attachments[0].name, 'public.txt');
  assert.equal(result.ticket.messages.some((message) => message.internal), false);
});

test('ticket details are not available to a different installation or a mismatched secret', async () => {
  const db = await createDb();
  const otherOwner = await getUserTicket({
    request: createRequest(otherInstallId, 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'),
    env: { DB: db },
    params: { ticketId },
  });
  assert.equal(otherOwner.status, 404);

  const wrongSecret = await getUserTicket({
    request: createRequest(installId, 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'),
    env: { DB: db },
    params: { ticketId },
  });
  assert.equal(wrongSecret.status, 401);
});

test('attachments accept only bounded safe file types', () => {
  const valid = parseTicketAttachments([{
    name: 'screenshot.jpeg',
    contentType: 'image/jpeg',
    data: 'AQID',
  }]);
  assert.equal(valid.response, undefined);
  assert.equal(valid.attachments[0].bytes.byteLength, 3);

  const forbidden = parseTicketAttachments([{
    name: 'script.exe',
    contentType: 'application/octet-stream',
    data: 'AQID',
  }]);
  assert.equal(forbidden.response.status, 400);

  const oversized = parseTicketAttachments([{
    name: 'huge.txt',
    contentType: 'text/plain',
    data: 'A'.repeat(700000),
  }]);
  assert.equal(oversized.response.status, 413);
});
