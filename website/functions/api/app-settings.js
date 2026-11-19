export async function onRequestGet({ env }) {
  if (!env.DB) return Response.json({ maintenanceMode: false, settings: {} }, { status: 503 });
  const rows = await env.DB.prepare('SELECT key, value FROM app_settings').all();
  const settings = {};
  for (const row of rows.results ?? []) {
    try { settings[row.key] = JSON.parse(row.value); }
    catch { settings[row.key] = row.value; }
  }
  return Response.json({
    ok: true,
    maintenanceMode: settings.maintenanceMode === true,
    settings,
  });
}
