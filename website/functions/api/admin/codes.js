import { audit, randomToken, requireAdmin, sha256Hex } from '../../_shared/admin-auth.js';

const rewardTypes = new Set([
  'premium',
  'badge',
  'profile_frame',
  'profile_color',
  'theme',
  'beta_access',
]);
const rewardThemes = new Set([
  'midnight-blue',
  'cyber-purple',
  'neon-green',
  'crimson-red',
  'arctic-cyan',
  'golden-black',
  'rose-pink',
  'pure-white',
]);

function randomCode(length = 16) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let code = '';
  for (const byte of bytes) code += alphabet[byte % alphabet.length];
  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}-${code.slice(12)}`;
}

function normalizeReward(value) {
  if (!value || typeof value !== 'object') return null;
  const rewardType = typeof value.type === 'string' ? value.type.trim() : '';
  if (!rewardTypes.has(rewardType)) return null;
  const rewardValue = value.value == null ? '' : String(value.value).trim().slice(0, 200);
  if (rewardType === 'premium') {
    const duration = Number(rewardValue);
    if (!Number.isSafeInteger(duration) || duration <= 0) return null;
  } else if (!rewardValue) {
    return null;
  }
  if (rewardType === 'profile_color' && !/^#[0-9A-F]{6}$/i.test(rewardValue)) return null;
  if (rewardType === 'theme' && !rewardThemes.has(rewardValue)) return null;
  return { rewardType, rewardValue };
}

function normalizeExpiration(value, now) {
  if (value == null || value === '') return { expiresAt: null };
  const expiresAt = Number(value);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return { error: 'Das Ablaufdatum muss in der Zukunft liegen.' };
  return { expiresAt };
}

function normalizeLimit(value, fallback = 1) {
  const maxRedemptions = Number(value ?? fallback);
  if (!Number.isInteger(maxRedemptions) || maxRedemptions < 1 || maxRedemptions > 100000) return null;
  return maxRedemptions;
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Administration storage is not configured.' }, { status: 503 });
  const auth = await requireAdmin(request, env, env.DB, 'codes.manage');
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

  const url = new URL(request.url);
  const codeId = String(url.searchParams.get('id') ?? '').trim();
  if (codeId) {
    const code = await env.DB.prepare(`
      SELECT id, code_name, public_code, reward_type, reward_value, description, status,
             expires_at, max_redemptions, current_redemptions, created_at, updated_at
      FROM redeem_codes WHERE id = ?
    `).bind(codeId).first();
    if (!code) return Response.json({ error: 'Code nicht gefunden.' }, { status: 404 });
    const redemptions = await env.DB.prepare(`
      SELECT r.redeemed_at, u.id AS user_id, u.display_name, r.install_id
      FROM code_redemptions r
      LEFT JOIN users u ON u.id = r.user_id
      WHERE r.code_id = ?
      ORDER BY r.redeemed_at DESC
      LIMIT 1000
    `).bind(codeId).all();
    return Response.json({ ok: true, code, redemptions: redemptions.results ?? [] });
  }

  const search = String(url.searchParams.get('search') ?? '').trim().slice(0, 128);
  const status = String(url.searchParams.get('status') ?? '').trim();
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 50)));
  const clauses = [];
  const binds = [];
  if (search) {
    clauses.push('(code_name LIKE ? OR public_code LIKE ? OR description LIKE ?)');
    const term = `%${search}%`;
    binds.push(term, term, term);
  }
  if (['active', 'disabled', 'expired', 'redeemed'].includes(status)) {
    clauses.push('status = ?');
    binds.push(status);
  }
  let query = `
    SELECT id, code_name, public_code, reward_type, reward_value, description, status,
           expires_at, max_redemptions, current_redemptions, created_at, updated_at
    FROM redeem_codes
  `;
  if (clauses.length) query += ` WHERE ${clauses.join(' AND ')}`;
  query += ' ORDER BY created_at DESC LIMIT ?';
  binds.push(limit);
  const rows = await env.DB.prepare(query).bind(...binds).all();
  return Response.json({ ok: true, codes: rows.results ?? [] });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Administration storage is not configured.' }, { status: 503 });
  const auth = await requireAdmin(request, env, env.DB, 'codes.manage');
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  }

  const action = body?.action;
  if (!['create', 'update', 'disable', 'enable', 'delete'].includes(action)) {
    return Response.json({ error: 'Ungültige Code-Aktion.' }, { status: 400 });
  }
  const now = Math.floor(Date.now() / 1000);

  if (action === 'create') {
    const reward = normalizeReward(body.reward);
    if (!reward) return Response.json({ error: 'Belohnung oder Belohnungswert ist ungültig.' }, { status: 400 });
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, 500) : '';
    const count = Number(body.count ?? 1);
    if (!Number.isInteger(count) || count < 1 || count > 25) return Response.json({ error: 'Es können 1 bis 25 Codes erstellt werden.' }, { status: 400 });
    const expiration = normalizeExpiration(body.expiresAt, now);
    if (expiration.error) return Response.json({ error: expiration.error }, { status: 400 });
    const maxRedemptions = normalizeLimit(body.maxRedemptions, 1);
    if (maxRedemptions === null) return Response.json({ error: 'Ungültiges Einlösungslimit.' }, { status: 400 });
    const requestedCode = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
    if (requestedCode && (count !== 1 || requestedCode.length < 12 || requestedCode.length > 128 || !/^[A-Z0-9-]+$/.test(requestedCode))) {
      return Response.json({ error: 'Eigene Codes benötigen mindestens 12 Zeichen und können einzeln erstellt werden.' }, { status: 400 });
    }
    const requestedName = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
    const status = body.active === false ? 'disabled' : 'active';
    const created = [];
    const statements = [];
    for (let index = 0; index < count; index += 1) {
      const codeValue = requestedCode || randomCode();
      const codeHash = await sha256Hex(codeValue);
      const duplicate = await env.DB.prepare('SELECT id FROM redeem_codes WHERE code_hash = ?').bind(codeHash).first();
      if (duplicate) return Response.json({ error: 'Dieser Code ist bereits vorhanden.' }, { status: 409 });
      const id = randomToken(16);
      const codeName = requestedName
        ? (count === 1 ? requestedName : `${requestedName} ${index + 1}`)
        : codeValue;
      statements.push(env.DB.prepare(`
        INSERT INTO redeem_codes
          (id, code_hash, code_hint, code_name, public_code, reward_type, reward_value, description,
           status, expires_at, max_redemptions, current_redemptions, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
      `).bind(
        id, codeHash, codeValue, codeName, codeValue, reward.rewardType, reward.rewardValue,
        description || null, status, expiration.expiresAt, maxRedemptions, auth.admin.id, now, now,
      ));
      created.push({ id, code: codeValue, name: codeName });
    }
    await env.DB.batch(statements);
    for (const item of created) await audit(env.DB, auth.admin.id, 'code.created', 'redeem_code', item.id, 'success');
    return Response.json({ ok: true, codes: created });
  }

  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id || id.length > 128) return Response.json({ error: 'Ungültige Code-ID.' }, { status: 400 });
  const code = await env.DB.prepare(`
    SELECT id, status, expires_at, max_redemptions, current_redemptions
    FROM redeem_codes WHERE id = ?
  `).bind(id).first();
  if (!code) return Response.json({ error: 'Code nicht gefunden.' }, { status: 404 });

  if (action === 'update') {
    const reward = normalizeReward(body.reward);
    if (!reward) return Response.json({ error: 'Belohnung oder Belohnungswert ist ungültig.' }, { status: 400 });
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, 500) : '';
    if (!name) return Response.json({ error: 'Ein Code-Name ist erforderlich.' }, { status: 400 });
    const expiration = normalizeExpiration(body.expiresAt, now);
    if (expiration.error) return Response.json({ error: expiration.error }, { status: 400 });
    const maxRedemptions = normalizeLimit(body.maxRedemptions, code.max_redemptions);
    if (maxRedemptions === null || maxRedemptions < code.current_redemptions) {
      return Response.json({ error: 'Das Gesamteinlösungslimit darf nicht unter bereits erfolgten Einlösungen liegen.' }, { status: 400 });
    }
    const status = body.active === false ? 'disabled' : 'active';
    await env.DB.prepare(`
      UPDATE redeem_codes
      SET code_name = ?, reward_type = ?, reward_value = ?, description = ?, status = ?,
          expires_at = ?, max_redemptions = ?, updated_at = ?
      WHERE id = ?
    `).bind(name, reward.rewardType, reward.rewardValue, description || null, status, expiration.expiresAt, maxRedemptions, now, id).run();
  } else if (action === 'disable') {
    await env.DB.prepare(`UPDATE redeem_codes SET status = 'disabled', updated_at = ? WHERE id = ?`).bind(now, id).run();
  } else if (action === 'enable') {
    if ((code.expires_at && code.expires_at <= now) || code.current_redemptions >= code.max_redemptions) {
      return Response.json({ error: 'Abgelaufene oder aufgebrauchte Codes können nicht aktiviert werden.' }, { status: 409 });
    }
    await env.DB.prepare(`UPDATE redeem_codes SET status = 'active', updated_at = ? WHERE id = ?`).bind(now, id).run();
  } else {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM code_redemptions WHERE code_id = ?').bind(id),
      env.DB.prepare('DELETE FROM code_rewards WHERE code_id = ?').bind(id),
      env.DB.prepare('DELETE FROM redeem_codes WHERE id = ?').bind(id),
    ]);
  }
  await audit(env.DB, auth.admin.id, `code.${action}`, 'redeem_code', id, 'success');
  return Response.json({ ok: true });
}
