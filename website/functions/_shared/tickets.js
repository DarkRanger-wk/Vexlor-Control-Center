import { randomToken, sha256Hex } from './admin-auth.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[4-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ticketIdPattern = /^[A-Za-z0-9_-]{20,64}$/;
const attachmentTypes = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
  ['text/plain', '.txt'],
  ['application/pdf', '.pdf'],
]);
const maxAttachmentBytes = 512 * 1024;
const maxAttachments = 3;
const maxAttachmentTotalBytes = 1024 * 1024;

export function ticketError(message, status) {
  return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function readTicketBody(request, maxBytes = 2 * 1024 * 1024) {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > maxBytes) return { response: ticketError('Die Anfrage ist zu groß.', 413) };
  let text;
  try {
    text = await request.text();
  } catch {
    return { response: ticketError('Die Anfrage konnte nicht gelesen werden.', 400) };
  }
  if (text.length > maxBytes) return { response: ticketError('Die Anfrage ist zu groß.', 413) };
  try {
    const body = JSON.parse(text);
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return { response: ticketError('Ungültige Anfrage.', 400) };
    }
    return { body };
  } catch {
    return { response: ticketError('Ungültige Anfrage.', 400) };
  }
}

export async function requireTicketIdentity(request, env, allowCreate = false) {
  if (!env.DB) return { response: ticketError('Der Ticketdienst ist nicht konfiguriert.', 503) };
  const installId = request.headers.get('x-vcc-install-id') ?? '';
  const authorization = request.headers.get('authorization') ?? '';
  const token = /^Bearer ([A-Za-z0-9_-]{40,64})$/.exec(authorization)?.[1] ?? '';
  if (!uuidPattern.test(installId) || !token) {
    return { response: ticketError('Die lokale Ticket-Identität ist ungültig.', 401) };
  }

  const tokenHash = await sha256Hex(token);
  let identity = await env.DB.prepare(`
    SELECT install_id, token_hash, display_name
    FROM ticket_identities WHERE install_id = ?
  `).bind(installId).first();

  if (!identity && allowCreate) {
    const rawName = request.headers.get('x-vcc-display-name') ?? '';
    const displayName = rawName.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 24) || 'Lokaler Nutzer';
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(`
      INSERT OR IGNORE INTO ticket_identities (install_id, token_hash, display_name, created_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(installId, tokenHash, displayName, now, now).run();
    identity = await env.DB.prepare(`
      SELECT install_id, token_hash, display_name
      FROM ticket_identities WHERE install_id = ?
    `).bind(installId).first();
  }

  if (!identity) return { identity: null };
  if (!constantTimeEqual(identity.token_hash, tokenHash)) {
    return { response: ticketError('Die lokale Ticket-Identität ist nicht autorisiert.', 401) };
  }

  const now = Math.floor(Date.now() / 1000);
  const rawName = request.headers.get('x-vcc-display-name') ?? '';
  const displayName = rawName.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 24) || identity.display_name;
  await env.DB.prepare('UPDATE ticket_identities SET display_name = ?, last_seen_at = ? WHERE install_id = ?')
    .bind(displayName, now, installId).run();
  return { identity: { installId, displayName } };
}

export function isTicketId(value) {
  return typeof value === 'string' && ticketIdPattern.test(value);
}

export function validateTicketText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function parseTicketAttachments(value) {
  if (value === undefined) return { attachments: [] };
  if (!Array.isArray(value) || value.length > maxAttachments) {
    return { response: ticketError('Es sind höchstens drei Anhänge pro Nachricht erlaubt.', 400) };
  }

  let totalBytes = 0;
  const attachments = [];
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      return { response: ticketError('Ein Dateianhang ist ungültig.', 400) };
    }
    const fileName = typeof entry.name === 'string'
      ? entry.name.trim().replace(/[\\/\u0000-\u001f\u007f]/g, '').slice(0, 100)
      : '';
    const contentType = typeof entry.contentType === 'string' ? entry.contentType.toLowerCase() : '';
    const base64 = typeof entry.data === 'string' ? entry.data : '';
    const extension = attachmentTypes.get(contentType);
    const lowerFileName = fileName.toLowerCase();
    const extensionMatches = extension && (lowerFileName.endsWith(extension)
      || (contentType === 'image/jpeg' && lowerFileName.endsWith('.jpeg')));
    if (!fileName || !extensionMatches || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
      return { response: ticketError('Erlaubt sind PNG, JPEG, WebP, TXT und PDF.', 400) };
    }
    if (base64.length > Math.ceil(maxAttachmentBytes / 3) * 4 + 8) {
      return { response: ticketError('Ein Anhang darf höchstens 512 KB groß sein.', 413) };
    }
    let binary;
    try {
      binary = atob(base64);
    } catch {
      return { response: ticketError('Ein Dateianhang ist ungültig kodiert.', 400) };
    }
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    if (!bytes.byteLength || bytes.byteLength > maxAttachmentBytes) {
      return { response: ticketError('Ein Anhang muss kleiner als 512 KB sein.', 413) };
    }
    totalBytes += bytes.byteLength;
    if (totalBytes > maxAttachmentTotalBytes) {
      return { response: ticketError('Alle Anhänge zusammen dürfen höchstens 1 MB groß sein.', 413) };
    }
    attachments.push({ id: randomToken(16), fileName, contentType, bytes });
  }
  return { attachments };
}

export async function loadTicketMessages(db, ticketNumber, includeInternal) {
  const messagesQuery = includeInternal
    ? 'SELECT id, author_type, author_id, is_internal, body, created_at FROM ticket_messages WHERE ticket_number = ? ORDER BY created_at ASC LIMIT 200'
    : 'SELECT id, author_type, author_id, is_internal, body, created_at FROM ticket_messages WHERE ticket_number = ? AND is_internal = 0 ORDER BY created_at ASC LIMIT 200';
  const messagesResult = await db.prepare(messagesQuery).bind(ticketNumber).all();
  const messages = messagesResult.results ?? [];
  const attachmentsResult = await db.prepare(`
    SELECT a.id, a.message_id, a.file_name, a.content_type, a.byte_size, a.content
    FROM ticket_attachments a
    JOIN ticket_messages m ON m.id = a.message_id
    WHERE a.ticket_number = ? ${includeInternal ? '' : 'AND m.is_internal = 0'}
    ORDER BY a.created_at ASC
  `).bind(ticketNumber).all();
  const attachmentsByMessage = new Map();
  for (const file of attachmentsResult.results ?? []) {
    const bytes = file.content instanceof Uint8Array ? file.content : new Uint8Array(file.content);
    const attachments = attachmentsByMessage.get(file.message_id) ?? [];
    attachments.push({
      id: file.id,
      name: file.file_name,
      contentType: file.content_type,
      byteSize: file.byte_size,
      data: encodeBase64(bytes),
    });
    attachmentsByMessage.set(file.message_id, attachments);
  }
  return messages.map((message) => ({
    id: message.id,
    authorType: message.author_type,
    authorId: message.author_id,
    internal: Boolean(message.is_internal),
    body: message.body,
    createdAt: message.created_at,
    attachments: attachmentsByMessage.get(message.id) ?? [],
  }));
}

function constantTimeEqual(left, right) {
  if (typeof left !== 'string' || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < right.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function encodeBase64(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}
