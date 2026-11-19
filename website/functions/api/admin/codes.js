import { audit, randomToken, requireAdmin, sha256Hex } from '../../_shared/admin-auth.js';

function randomCode(length = 16) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let code = '';
  for (const byte of bytes) code += alphabet[byte % alphabet.length];
  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}-${code.slice(12)}`;
}

function normalizeReward(value) {
  if (!value || typeof value !== 'object') return null;
  const rewardType = String(value.type ?? '').trim();
  if (!rewardType || rewardType.length > 64) return null;
  const rewardValue = value.value == null ? null : String(value.value).slice(0, 500);
  return { rewardType, rewardValue };
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Administration storage is not configured.' }, { status: 503 });
  const auth = await requireAdmin(request, env, env.DB, 'codes.manage');
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

  const url = new URL(request.url);
  const secret = url.searchParams.get('secret') === '1';
  const search = String(url.searchParams.get('search') ?? '').trim();
  const status = String(url.searchParams.get('status') ?? '').trim();
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 25)));
  const clauses = [`secret = ?`];
  const binds = [secret ? 1 : 0];
  if (search) {
    clauses.push('code_hint LIKE ?');
    binds.push(`%${search}%`);
  }
  if (['active', 'disabled', 'expired', 'redeemed'].includes(status)) {
    clauses.push('status = ?');
    binds.push(status);
  }
  binds.push(limit);
  const rows = await env.DB.prepare(`
    SELECT id, code_hint, reward_type, reward_value, description, secret, status,
           expires_at, max_redemptions, current_redemptions, created_at, updated_at
    FROM redeem_codes
    WHERE ${clauses.join(' AND ')}
    ORDER BY created_at DESC LIMIT ?
  `).bind(...binds).all();
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
  if (!['create', 'disable', 'enable', 'delete'].includes(action)) {
    return Response.json({ error: 'Ungültige Code-Aktion.' }, { status: 400 });
  }
  const now = Math.floor(Date.now() / 1000);

  if (action === 'create') {
    const reward = normalizeReward(body.reward);
    if (!reward) return Response.json({ error: 'Eine gültige Belohnung ist erforderlich.' }, { status: 400 });
    const description = typeof body.description === 'string' ? body.description.slice(0, 500) : null;
    const count = Math.min(25, Math.max(1, Number(body.count ?? 1)));
    const secret = body.secret === true ? 1 : 0;
    if (secret && auth.admin.roleId !== 'super_admin') {
      return Response.json({ error: 'Secret Codes dürfen nur von Super Administratoren verwaltet werden.' }, { status: 403 });
    }
    const expiresAt = body.expiresAt == null ? null : Number(body.expiresAt);
    if (expiresAt !== null && (!Number.isInteger(expiresAt) || expiresAt <= now)) {
      return Response.json({ error: 'Ungültiges Ablaufdatum.' }, { status: 400 });
    }
    const maxRedemptions = Math.min(100000, Math.max(1, Number(body.maxRedemptions ?? 1)));
    if (!Number.isInteger(maxRedemptions)) return Response.json({ error: 'Ungültiges Einlösungslimit.' }, { status: 400 });

    const created = [];
    const statements = [];
    for (let index = 0; index < count; index += 1) {
      const code = typeof body.code === 'string' && body.code.trim() && count === 1
        ? body.code.trim().toUpperCase().slice(0, 128)
        : randomCode();
      if (typeof body.code === 'string' && body.code.trim() && count === 1 && code.length < 12) {
        return Response.json({ error: 'Eigene Codes müssen mindestens 12 Zeichen lang sein.' }, { status: 400 });
      }
      const codeHash = await sha256Hex(code);
      const id = randomToken(16);
      const hint = secret ? `••••-${code.slice(-4)}` : code;
      statements.push(env.DB.prepare(`
        INSERT INTO redeem_codes
          (id, code_hash, code_hint, reward_type, reward_value, description, secret, status, expires_at, max_redemptions, current_redemptions, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, 0, ?, ?, ?)
      `).bind(id, codeHash, hint, reward.rewardType, reward.rewardValue, description, secret, expiresAt, maxRedemptions, auth.admin.id, now, now));
      created.push({ id, code: secret ? code : code, hint });
    }
    await env.DB.batch(statements);
    for (const item of created) await audit(env.DB, auth.admin.id, 'code.created', 'redeem_code', item.id, 'success', secret ? 'secret_code_created' : null);
    return Response.json({ ok: true, codes: created });
  }

  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id || id.length > 128) return Response.json({ error: 'Ungültige Code-ID.' }, { status: 400 });
  const code = await env.DB.prepare('SELECT id, secret FROM redeem_codes WHERE id = ?').bind(id).first();
  if (!code) return Response.json({ error: 'Code nicht gefunden.' }, { status: 404 });
  if (code.secret && auth.admin.roleId !== 'super_admin') {
    return Response.json({ error: 'Keine Berechtigung für Secret Codes.' }, { status: 403 });
  }

  if (action === 'disable') {
    await env.DB.prepare(`UPDATE redeem_codes SET status = 'disabled', updated_at = ? WHERE id = ?`).bind(now, id).run();
  } else if (action === 'enable') {
    await env.DB.prepare(`UPDATE redeem_codes SET status = 'active', updated_at = ? WHERE id = ?`).bind(now, id).run();
  } else {
    await env.DB.prepare('DELETE FROM redeem_codes WHERE id = ?').bind(id).run();
  }
  await audit(env.DB, auth.admin.id, `code.${action}`, 'redeem_code', id, 'success');
  return Response.json({ ok: true });
}
