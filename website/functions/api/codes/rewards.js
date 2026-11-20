import { requireTicketIdentity } from '../../_shared/tickets.js';

const equippableRewardTypes = new Set([
  'badge',
  'profile_badge',
  'frame',
  'profile_frame',
  'profile_color',
  'color',
  'theme',
]);

async function loadUser(request, env) {
  const identityResult = await requireTicketIdentity(request, env, true);
  if (identityResult.response) return { response: identityResult.response };
  if (!identityResult.identity) {
    return { response: Response.json({ error: 'Die lokale Identität konnte nicht geladen werden.' }, { status: 401 }) };
  }
  const user = await env.DB.prepare('SELECT id, premium_until FROM users WHERE install_id = ?')
    .bind(identityResult.identity.installId).first();
  return { identity: identityResult.identity, user };
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Reward storage is not configured.' }, { status: 503 });
  const result = await loadUser(request, env);
  if (result.response) return result.response;
  if (!result.user) {
    return Response.json({ ok: true, rewards: [], premiumUntil: null }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  const rewards = await env.DB.prepare(`
    SELECT id, reward_type, reward_value, display_name, equipped, created_at
    FROM user_rewards
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 100
  `).bind(result.user.id).all();
  return Response.json({
    ok: true,
    rewards: rewards.results ?? [],
    premiumUntil: result.user.premium_until,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Reward storage is not configured.' }, { status: 503 });
  const result = await loadUser(request, env);
  if (result.response) return result.response;
  if (!result.user) return Response.json({ error: 'Es wurden noch keine Belohnungen freigeschaltet.' }, { status: 404 });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  }
  const action = body?.action;
  const rewardId = typeof body?.rewardId === 'string' ? body.rewardId.trim().slice(0, 64) : '';
  if (!['equip', 'unequip'].includes(action) || !rewardId) {
    return Response.json({ error: 'Ungültige Belohnungsaktion.' }, { status: 400 });
  }
  const reward = await env.DB.prepare(`
    SELECT id, reward_type
    FROM user_rewards
    WHERE id = ? AND user_id = ?
  `).bind(rewardId, result.user.id).first();
  if (!reward) return Response.json({ error: 'Belohnung nicht gefunden.' }, { status: 404 });
  if (!equippableRewardTypes.has(reward.reward_type)) {
    return Response.json({ error: 'Diese Belohnung kann nicht ausgerüstet werden.' }, { status: 400 });
  }

  if (action === 'equip') {
    await env.DB.batch([
      env.DB.prepare('UPDATE user_rewards SET equipped = 0 WHERE user_id = ? AND reward_type = ?')
        .bind(result.user.id, reward.reward_type),
      env.DB.prepare('UPDATE user_rewards SET equipped = 1 WHERE id = ? AND user_id = ?')
        .bind(reward.id, result.user.id),
    ]);
  } else {
    await env.DB.prepare('UPDATE user_rewards SET equipped = 0 WHERE id = ? AND user_id = ?')
      .bind(reward.id, result.user.id).run();
  }
  const updated = await env.DB.prepare(`
    SELECT id, reward_type, reward_value, display_name, equipped, created_at
    FROM user_rewards
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 100
  `).bind(result.user.id).all();
  return Response.json({ ok: true, rewards: updated.results ?? [] });
}
