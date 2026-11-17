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

## Telemetry and privacy

The desktop app sends pseudonymous session events only after the user enables **Optionale Nutzungsstatistiken senden** in Settings. It queues events locally while offline and sends a deletion request when consent is revoked. Pages Functions validate identifiers, deduplicate event IDs, limit event volume per installation, cap server-calculated heartbeat duration and expose aggregate statistics only.

The public website intentionally omits the private street address shown in the desktop app's local imprint. Replace it with a business/public mailing address before publishing if the legal imprint requires one. The legal pages must be reviewed before public release.
