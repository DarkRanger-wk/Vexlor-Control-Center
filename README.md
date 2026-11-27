# Vexlor Control Center

VCC is a German-language Windows desktop application built with Electron, React, TypeScript, Vite and electron-builder.

## Run and build

Requires Node.js 24+ and npm.

```powershell
npm install
npm run dev
npm test
npx tsc --noEmit
npm run build
npm run dist
```

`npm run dist` creates a Windows NSIS installer in `release/`. The installer can create Start-menu and desktop shortcuts, lets the user choose an install directory and includes an uninstaller. No administrator elevation is configured. The Windows application icon is in `assets/icons/vexlor.ico`.

## Implemented

- Local dashboard, system monitor, process/resource monitor and network view.
- CPU and memory values come from the current Windows host. GPU names, disks, adapters and processes use local Windows PowerShell/CIM/network interfaces. GPU utilization and temperatures are clearly marked unavailable rather than estimated.
- Locally persisted game entries, executable paths, descriptions, categories, cover images, favorites and last-launch dates. Games are started as child processes without shell interpolation; removing an entry does not remove game files.
- Gaming calculator, countdown, stopwatch, notes and QR-code generation. QR generation does not use a remote service.
- The timer and stopwatch keep running across page changes. While either is active, a compact always-on-top panel stays in the upper-right corner and remains available when the main window is closed; the timer plays a short audio alert at expiry.
- Screenshot Tool captures a selected area, a chosen monitor or an open window, previews and zooms PNGs, saves them locally or copies them to the clipboard. The configurable global shortcut defaults to Win + Shift + S when Windows permits it; use a different combination if Windows reserves that shortcut.
- Persisted themes, accent colors, local background images, reduced animations, compact sidebar, Windows autostart and local-data reset.
- Offline legal pages. Privacy and terms describe the current implementation and still need legal review before public distribution.
- Update checks use the fixed public GitHub repository `DarkRanger-wk/Vexlor-Control-Center`. Checks run at startup and every six hours when enabled in Settings, or manually from the top bar. The top-bar button always checks the latest release and, when available, downloads and installs its verified Windows `.exe` after the user's click.
- Telemetry is enabled by default for new installations. The app queues pseudonymous app/session timestamps, version and platform locally while offline and sends them to the Vexlor website; users can disable it in Settings, which requests deletion of the associated telemetry records. Existing saved preferences are preserved.
- The optional display name saved during setup is sent with an app-presence heartbeat and shown with online/offline status in the protected admin panel. This is separate from telemetry and is not disabled by turning telemetry off.
- Admin sessions are encrypted with Windows secure storage and restored across app restarts. Installing a newer app version ends the session and requires a fresh admin login.
- **Support & Hilfe** ermöglicht Fehlermeldungen, technischen Support, Fragen, Feedback, Ticketverlauf, Antworten und begrenzte Dateianhänge. Tickets sind an eine App-Installation gebunden; eine normale App-Anmeldung ist nicht erforderlich. Das zufällige lokale Ticket-Geheimnis wird mit Windows DPAPI verschlüsselt und verbleibt im Electron-Hauptprozess. Teamantworten aktualisieren die Kennzeichnung ungelesener Tickets und können während der App-Laufzeit eine Benachrichtigung auslösen.
- Das geschützte Admin Panel enthält ein **Ticket-Postfach** zum Suchen, Filtern, Zuweisen und Bearbeiten von Tickets. Teammitglieder mit `support.read` können Verläufe einsehen; Änderungen und Antworten erfordern `support.manage`. Interne Notizen sind von benutzersichtbaren Nachrichten getrennt und werden niemals über Benutzer-Ticket-Endpunkte ausgeliefert.
- Öffentliche Einlösecodes werden serverseitig geprüft und pro Installation einmalig eingelöst. Premium-Abos und kosmetische Belohnungen werden dauerhaft gespeichert; ausrüstbare Profilbelohnungen sind im Belohnungsbereich verwaltbar. Secret Codes werden nicht unterstützt.
- Vexlor Arcade enthält 39 Minispiele. Profile, Highscores, Spielzeit, Favoriten und Erfolge werden lokal zwischengespeichert und an die D1-Datenbank der authentifizierten App-Installation synchronisiert; offline bleibt der lokale Spielstand verfügbar.
- Das Admin Panel verwaltet öffentliche Codes und Code-Ankündigungen, zeigt Benutzer und Teamrollen und bietet geschützte Rollen-/Rechteverwaltung sowie GitHub-Downloadzahlen.
- `website/` is an independent Cloudflare Pages project with Pages Functions, D1-backed aggregate stats and live GitHub release information. See [website/README.md](./website/README.md) for local development and deployment.

## Data and network

Games, notes, settings and the optional display name are stored in `vcc-data.json` inside Electron's per-user application data folder. System and process data are read locally and kept in memory. Telemetry is enabled by default for new installations and transmits only pseudonymous app/session metadata; users can disable it in Settings at any time. The display name and last-active timestamp are sent separately for admin-panel presence and remain enabled when telemetry is disabled. A manual or enabled automatic update check contacts the fixed public GitHub repository and sends ordinary connection metadata such as the IP address.

Ticket-, Codebelohnungs- und Arcade-Profildaten werden in der unter `website/` konfigurierten Cloudflare-D1-Datenbank gespeichert. Die Migration `0003_ticket_system.sql` ergänzt Installationsidentitäten, Tickets, Nachrichten und begrenzte Binäranhänge. Die Migration `0004_public_codes_and_rewards.sql` entfernt alte Secret-Code-Datensätze samt Einlösungen, speichert öffentliche Codeinformationen und Belohnungsinventare und entfernt das Secret-Code-Schema. Migration `0005_arcade_profiles.sql` speichert Arcade-Profile pro authentifizierter App-Installation. Erlaubt sind PNG-, JPEG-, WebP-, TXT- und PDF-Dateien bis zu je 512 KB (insgesamt 1 MB und drei Dateien pro Nachricht); Anhänge werden ausschließlich über authentifizierte Ticket-APIs ausgeliefert. Vor Tests lokal mit `npm run db:migrate:local` und vor einem Deployment remote mit `npm run db:migrate:remote` im Ordner `website/` migrieren.

## Update setup

Every push to `main` builds the Windows NSIS installer for the exact version in `package.json` and publishes that GitHub Release if its tag does not exist. Each release commit needs a detailed German translation in `scripts/german-release-notes.mjs`; the workflow stops rather than publishing generic notes when a translation is missing. Update the version before pushing a release. GitHub Actions must have permission to write repository contents.

The in-app updater installs into the directory of the currently running executable. This keeps the executable path stable for existing taskbar pins; settings and other local data remain in the per-user application data folder.
