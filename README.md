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
- Persisted themes, accent colors, local background images, reduced animations, compact sidebar, Windows autostart and local-data reset.
- Offline legal pages. The supplied imprint is included verbatim; privacy and terms describe the current implementation and still need legal review before public distribution.
- Update checks use the GitHub Releases API for a repository entered by the user. Checks are manual by default; optional startup checks can be enabled in Settings. A newer release with a Windows `.exe` exposes a download button in the top bar. The button opens the verified GitHub asset in the default browser; installation and signature verification remain manual.

## Data and network

Games, notes and settings are stored in `vcc-data.json` inside Electron's per-user application data folder. System and process data are read locally and kept in memory. There is no telemetry or diagnostics upload. A manual or opted-in startup update check contacts GitHub and sends the configured repository along with ordinary connection metadata such as the IP address.

## Update setup

Set the repository in **Einstellungen → Updates** using `owner/repository`. For the top-bar download button, publish a versioned GitHub Release with a Windows NSIS `.exe` asset. The release tag must use `major.minor.patch` (optionally prefixed with `v`).
