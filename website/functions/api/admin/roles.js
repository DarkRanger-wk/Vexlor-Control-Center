import { audit, requireAdmin } from '../../_shared/admin-auth.js';

export async function onRequestGet({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Administration storage is not configured.' }, { status: 503 });
  const auth = await requireAdmin(request, env, env.DB, '*');
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });
  const roles = await env.DB.prepare('SELECT * FROM admin_roles ORDER BY name ASC').all();
  const permissions = await env.DB.prepare('SELECT * FROM admin_permissions ORDER BY role_id, permission').all();
  const admins = await env.DB.prepare('SELECT id, display_name, role_id, status, failed_attempts, locked_until, created_at, updated_at FROM admins ORDER BY created_at DESC').all();
  return Response.json({ ok: true, roles: roles.results ?? [], permissions: permissions.results ?? [], admins: admins.results ?? [] });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Administration storage is not configured.' }, { status: 503 });
  const auth = await requireAdmin(request, env, env.DB, '*');
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Ungültige Anfrage.' }, { status: 400 }); }
  const adminId = typeof body?.adminId === 'string' ? body.adminId.trim().slice(0, 128) : '';
  const roleId = typeof body?.roleId === 'string' ? body.roleId.trim().slice(0, 64) : '';
  if (!adminId || !['super_admin', 'admin', 'moderator'].includes(roleId)) {
    return Response.json({ error: 'Ungültiger Administrator oder Rolle.' }, { status: 400 });
  }
  if (adminId === auth.admin.id) return Response.json({ error: 'Die eigene Rolle kann nicht geändert werden.' }, { status: 400 });
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare('UPDATE admins SET role_id = ?, updated_at = ? WHERE id = ?')
    .bind(roleId, now, adminId).run();
  await audit(env.DB, auth.admin.id, 'admin.role.changed', 'admin', adminId, 'success');
  return Response.json({ ok: true });
}
