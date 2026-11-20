import { audit, randomToken, requireAdmin } from '../../_shared/admin-auth.js';

const builtInRoles = new Set(['super_admin', 'admin', 'moderator']);
const allowedPermissions = new Set([
  'users.read',
  'users.manage',
  'codes.manage',
  'premium.manage',
  'announcements.manage',
  'support.read',
  'support.manage',
  'features.manage',
  'stats.read',
  'audit.read',
]);

function normalizePermissions(value) {
  if (!Array.isArray(value) || value.length > allowedPermissions.size) return null;
  const permissions = [...new Set(value)];
  if (permissions.some((permission) => typeof permission !== 'string' || !allowedPermissions.has(permission))) return null;
  return permissions;
}

function roleSlug(name) {
  return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'team';
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Administration storage is not configured.' }, { status: 503 });
  const auth = await requireAdmin(request, env, env.DB, '*');
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });
  const roles = await env.DB.prepare('SELECT * FROM admin_roles ORDER BY name ASC').all();
  const permissions = await env.DB.prepare('SELECT * FROM admin_permissions ORDER BY role_id, permission').all();
  const admins = await env.DB.prepare(`
    SELECT a.id, a.display_name, a.role_id, a.status, a.failed_attempts, a.locked_until,
           a.created_at, a.updated_at, r.name AS role_name
    FROM admins a
    LEFT JOIN admin_roles r ON r.id = a.role_id
    ORDER BY a.created_at DESC
  `).all();
  return Response.json({
    ok: true,
    roles: roles.results ?? [],
    permissions: permissions.results ?? [],
    admins: admins.results ?? [],
    availablePermissions: [...allowedPermissions],
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return Response.json({ error: 'Administration storage is not configured.' }, { status: 503 });
  const auth = await requireAdmin(request, env, env.DB, '*');
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  }
  const action = body?.action ?? 'assign';
  const now = Math.floor(Date.now() / 1000);

  if (action === 'create' || action === 'update') {
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 48) : '';
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, 200) : '';
    const permissions = normalizePermissions(body.permissions);
    if (!name || !description || !permissions) {
      return Response.json({ error: 'Name, Beschreibung und gültige Berechtigungen sind erforderlich.' }, { status: 400 });
    }

    if (action === 'create') {
      const duplicate = await env.DB.prepare('SELECT id FROM admin_roles WHERE lower(name) = lower(?)').bind(name).first();
      if (duplicate) return Response.json({ error: 'Eine Rolle mit diesem Namen existiert bereits.' }, { status: 409 });
      const id = `custom-${roleSlug(name)}-${randomToken(6)}`;
      const statements = [
        env.DB.prepare('INSERT INTO admin_roles (id, name, description, created_at) VALUES (?, ?, ?, ?)')
          .bind(id, name, description, now),
        ...permissions.map((permission) => env.DB.prepare(
          'INSERT INTO admin_permissions (role_id, permission) VALUES (?, ?)',
        ).bind(id, permission)),
      ];
      await env.DB.batch(statements);
      await audit(env.DB, auth.admin.id, 'admin.role.created', 'admin_role', id, 'success');
      return Response.json({ ok: true, roleId: id });
    }

    const roleId = typeof body.roleId === 'string' ? body.roleId.trim().slice(0, 64) : '';
    if (!roleId || builtInRoles.has(roleId)) {
      return Response.json({ error: 'Die integrierten Rollen können nicht bearbeitet werden.' }, { status: 400 });
    }
    const role = await env.DB.prepare('SELECT id FROM admin_roles WHERE id = ?').bind(roleId).first();
    if (!role) return Response.json({ error: 'Rolle nicht gefunden.' }, { status: 404 });
    const duplicate = await env.DB.prepare('SELECT id FROM admin_roles WHERE lower(name) = lower(?) AND id != ?')
      .bind(name, roleId).first();
    if (duplicate) return Response.json({ error: 'Eine Rolle mit diesem Namen existiert bereits.' }, { status: 409 });
    await env.DB.batch([
      env.DB.prepare('UPDATE admin_roles SET name = ?, description = ? WHERE id = ?').bind(name, description, roleId),
      env.DB.prepare('DELETE FROM admin_permissions WHERE role_id = ?').bind(roleId),
      ...permissions.map((permission) => env.DB.prepare(
        'INSERT INTO admin_permissions (role_id, permission) VALUES (?, ?)',
      ).bind(roleId, permission)),
    ]);
    await audit(env.DB, auth.admin.id, 'admin.role.updated', 'admin_role', roleId, 'success');
    return Response.json({ ok: true });
  }

  if (action === 'delete') {
    const roleId = typeof body.roleId === 'string' ? body.roleId.trim().slice(0, 64) : '';
    if (!roleId || builtInRoles.has(roleId)) {
      return Response.json({ error: 'Die integrierten Rollen können nicht gelöscht werden.' }, { status: 400 });
    }
    const assigned = await env.DB.prepare('SELECT id FROM admins WHERE role_id = ? LIMIT 1').bind(roleId).first();
    if (assigned) return Response.json({ error: 'Die Rolle wird noch Teammitgliedern zugewiesen.' }, { status: 409 });
    const role = await env.DB.prepare('SELECT id FROM admin_roles WHERE id = ?').bind(roleId).first();
    if (!role) return Response.json({ error: 'Rolle nicht gefunden.' }, { status: 404 });
    await env.DB.batch([
      env.DB.prepare('DELETE FROM admin_permissions WHERE role_id = ?').bind(roleId),
      env.DB.prepare('DELETE FROM admin_roles WHERE id = ?').bind(roleId),
    ]);
    await audit(env.DB, auth.admin.id, 'admin.role.deleted', 'admin_role', roleId, 'success');
    return Response.json({ ok: true });
  }

  if (action !== 'assign') return Response.json({ error: 'Ungültige Rollenaktion.' }, { status: 400 });
  const adminId = typeof body?.adminId === 'string' ? body.adminId.trim().slice(0, 128) : '';
  const roleId = typeof body?.roleId === 'string' ? body.roleId.trim().slice(0, 64) : '';
  if (!adminId || !roleId) return Response.json({ error: 'Administrator und Rolle sind erforderlich.' }, { status: 400 });
  if (adminId === auth.admin.id) return Response.json({ error: 'Die eigene Rolle kann nicht geändert werden.' }, { status: 400 });
  const [admin, role] = await Promise.all([
    env.DB.prepare('SELECT id FROM admins WHERE id = ?').bind(adminId).first(),
    env.DB.prepare('SELECT id FROM admin_roles WHERE id = ?').bind(roleId).first(),
  ]);
  if (!admin || !role) return Response.json({ error: 'Administrator oder Rolle wurde nicht gefunden.' }, { status: 404 });
  await env.DB.batch([
    env.DB.prepare('UPDATE admins SET role_id = ?, updated_at = ? WHERE id = ?').bind(roleId, now, adminId),
    env.DB.prepare('UPDATE admin_sessions SET revoked_at = ? WHERE admin_id = ? AND revoked_at IS NULL').bind(now, adminId),
  ]);
  await audit(env.DB, auth.admin.id, 'admin.role.changed', 'admin', adminId, 'success');
  return Response.json({ ok: true });
}
