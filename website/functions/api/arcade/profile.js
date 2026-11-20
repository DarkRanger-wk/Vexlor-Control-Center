import { readTicketBody, requireTicketIdentity, ticketError } from '../../_shared/tickets.js';

const maxProfileBytes = 64 * 1024;

export async function onRequestGet({ request, env }) {
  if (!env.DB) return ticketError('Die Arcade-Datenbank ist nicht konfiguriert.', 503);
  const identityResult = await requireTicketIdentity(request, env, true);
  if (identityResult.response) return identityResult.response;

  const row = await env.DB.prepare(`
    SELECT profile_json, updated_at
    FROM arcade_profiles
    WHERE install_id = ?
  `).bind(identityResult.identity.installId).first();
  if (!row) {
    return Response.json({ ok: true, profile: null, updatedAt: null }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  let profile;
  try {
    profile = JSON.parse(row.profile_json);
  } catch {
    return ticketError('Das gespeicherte Arcade-Profil ist beschädigt.', 500);
  }
  return Response.json({ ok: true, profile, updatedAt: row.updated_at }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return ticketError('Die Arcade-Datenbank ist nicht konfiguriert.', 503);
  const identityResult = await requireTicketIdentity(request, env, true);
  if (identityResult.response) return identityResult.response;

  const parsed = await readTicketBody(request, maxProfileBytes);
  if (parsed.response) return parsed.response;
  const profile = parsed.body.profile;
  if (typeof profile !== 'object' || profile === null || Array.isArray(profile)) {
    return ticketError('Das Arcade-Profil ist ungültig.', 400);
  }
  const profileJson = JSON.stringify(profile);
  if (new TextEncoder().encode(profileJson).byteLength > maxProfileBytes) {
    return ticketError('Das Arcade-Profil ist zu groß.', 413);
  }

  const updatedAt = Math.floor(Date.now() / 1000);
  await env.DB.prepare(`
    INSERT INTO arcade_profiles (install_id, profile_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(install_id) DO UPDATE SET
      profile_json = excluded.profile_json,
      updated_at = excluded.updated_at
  `).bind(identityResult.identity.installId, profileJson, updatedAt).run();

  return Response.json({ ok: true, profile, updatedAt }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
