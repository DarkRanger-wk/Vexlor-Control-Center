# Vexlor Control Center website

The website is a separate Cloudflare Pages project. Static pages live in `public/`; API endpoints are Pages Functions in `functions/api/`; telemetry is stored in Cloudflare D1.

## Local development

```powershell
npm install
npm run dev
```

Open `http://localhost:4173`. Release information comes from the public GitHub API. Until D1 is configured, the stats API reports that its storage is not configured.

## Cloudflare Pages deployment

The Pages project name `infos-vcc` maps to `https://infos-vcc.pages.dev`.

1. Sign in to the Cloudflare account that owns the `infos-vcc` Pages project:

   ```powershell
   npx wrangler login
   ```

2. The D1 database is already created for this project. Its ID is configured in `wrangler.toml`.

   ```powershell
   npm run db:migrate:remote
   ```

3. Create the Pages project if it does not exist:

   ```powershell
   npx wrangler pages project create infos-vcc --production-branch main
   ```

4. Deploy the site and Functions:

   ```powershell
   npm run deploy
   ```

If the Pages project already exists, skip its creation. Keep the D1 database ID and the Cloudflare account credentials private. No API secret is embedded in the desktop app.

## Vexlor Super Admin

The administration API requires server-side configuration and uses Cloudflare D1 plus a Cloudflare secret.

1. Generate an Argon2id password hash interactively:

   ```powershell
   npm run admin:password
   ```

   The terminal does not echo the password and the script prints only `ADMIN_PASSWORD_HASH=<hash>`.

2. In Cloudflare Pages, open **Settings > Environment variables** and add `ADMIN_PASSWORD_HASH` as an encrypted secret for Production and Preview. Do not add the clear-text password or hash to Git.

3. Apply migrations:

   ```powershell
   npm run db:migrate:remote
   ```

4. The first login creates a local `bootstrap-super-admin` identity against the external hash. The hash can be rotated by replacing the Pages secret and redeploying; existing admin sessions should be revoked before a password rotation.

Protected admin routes are under `/api/admin/*`. Critical actions require a valid HttpOnly session and server-side role/permission checks. Redeem codes are hashed for verification and their public values are exposed by the public catalogue; code values are never written to logs. There is no Secret-Code category or creation path. Custom team roles and permissions can be changed only by the Super Administrator. The dashboard reads aggregate download counts from the public GitHub Releases API; if GitHub is unavailable, the dashboard reports that statistic as unavailable without hiding the D1-backed metrics.

The migrations `migrations/0004_public_codes_and_rewards.sql` and `migrations/0005_arcade_profiles.sql` must be applied after the existing migrations. Migration 0004 permanently deletes legacy Secret-Code rows and their redemption records, backfills public codes and reward inventory, and drops the obsolete `secret` column. Migration 0005 stores arcade profiles by authenticated installation. Apply migrations locally before development with `npm run db:migrate:local`; apply them to production only as part of an approved deployment with `npm run db:migrate:remote`.

The app's `/api/codes/redeem` and `/api/codes/rewards` calls use the installation identity already protected by Electron Windows DPAPI. The API ignores client-supplied installation and user identifiers, enforces one redemption per installation, and persists earned rewards separately so deleting a code does not revoke an already granted reward.

The desktop app never contains the administrator password, session secret or password hash. It authenticates only through the backend.

## Ticket and support system

Der Desktop-Bereich **Support & Hilfe** erstellt private Tickets über `/api/tickets`. Da die normale App kein Benutzerkonto erfordert, sind Tickets an eine einzelne Installation gebunden. Electron erstellt dafür eine zufällige Installationskennung und ein Bearer-Geheimnis, verschlüsselt dieses mit Windows DPAPI und sendet es ausschließlich aus dem Hauptprozess. In D1 wird nur der SHA-256-Hash gespeichert. Der Zugriff von einer zweiten Installation ist bewusst nicht möglich.

Administratoren und Supportmitarbeiter verwenden im **Ticket-Postfach** die vorhandenen Berechtigungen `support.read` und `support.manage`. Serverrouten liefern interne Nachrichten nur an authentifizierte Supportmitarbeiter aus; Benutzer-Endpunkte schließen sie ausdrücklich aus. Antworten und Ticketaktivitäten aktualisieren Ungelesen-Zähler, die die laufende App regelmäßig abfragt.

Die Migration `migrations/0003_ticket_system.sql` erstellt Tabellen für Installationsidentitäten, Tickets, Nachrichten und Anhänge. Vor Entwicklung oder Tests lokal mit `npm run db:migrate:local` anwenden; vor dem Pages-Functions-Deployment mit `npm run db:migrate:remote` auf die Produktionsdatenbank anwenden. Die App führt Migrationen und Deployments nicht automatisch aus.

Anhänge werden als D1-BLOBs gespeichert und auf drei Dateien, je 512 KB und insgesamt 1 MB pro Nachricht begrenzt. Erlaubt sind PNG, JPEG, WebP, Klartext und PDF. Ausführbare Dateien, HTML und SVG werden abgelehnt. Pro Installation sind zehn neue Tickets pro Tag und pro IP-Hash zwanzig neue Tickets pro Tag möglich.

## Telemetry and privacy

New desktop app installations have **Optionale Nutzungsstatistiken senden** enabled by default. Users can disable it in Settings; saved preferences on existing installations are preserved. The app queues pseudonymous session events locally while offline and sends a deletion request when telemetry is disabled. Pages Functions validate identifiers, deduplicate event IDs, limit event volume per installation, cap server-calculated heartbeat duration and expose aggregate statistics only.

The public website intentionally omits the private street address shown in the desktop app's local imprint. Replace it with a business/public mailing address before publishing if the legal imprint requires one. The legal pages must be reviewed before public release.
