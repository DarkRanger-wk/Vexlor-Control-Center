export async function onRequestGet({ env }) {
  if (!env.DB) return Response.json({ error: 'Code storage is not configured.' }, { status: 503 });
  const now = Math.floor(Date.now() / 1000);
  const result = await env.DB.prepare(`
    SELECT id, code_name, public_code, reward_type, reward_value, description,
           expires_at, max_redemptions, current_redemptions,
           CASE
             WHEN status = 'expired' OR (expires_at IS NOT NULL AND expires_at <= ?) THEN 'expired'
             WHEN status = 'redeemed' OR current_redemptions >= max_redemptions THEN 'redeemed'
             ELSE 'active'
           END AS public_status
    FROM redeem_codes
    WHERE status != 'disabled'
    ORDER BY created_at DESC
    LIMIT 100
  `).bind(now).all();
  const codes = (result.results ?? []).map((code) => ({
    id: code.id,
    name: code.code_name || code.public_code,
    code: code.public_code,
    rewardType: code.reward_type,
    rewardValue: code.reward_value,
    description: code.description,
    expiresAt: code.expires_at,
    remaining: Math.max(0, code.max_redemptions - code.current_redemptions),
    status: code.public_status,
  }));
  return Response.json({ ok: true, codes }, { headers: { 'Cache-Control': 'no-store' } });
}
