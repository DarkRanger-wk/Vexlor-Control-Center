export async function onRequestGet({ env }) {
  if (!env.DB) return Response.json({ features: {}, notice: 'Administration storage is not configured.' }, { status: 503 });
  const rows = await env.DB.prepare('SELECT key, name, enabled, beta, config FROM feature_flags').all();
  const features = {};
  for (const row of rows.results ?? []) {
    let config = null;
    try { config = row.config ? JSON.parse(row.config) : null; } catch { config = null; }
    features[row.key] = { name: row.name, enabled: Boolean(row.enabled), beta: Boolean(row.beta), config };
  }
  return Response.json({ ok: true, features });
}
