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
- Offline legal pages. The supplied imprint is included verbatim; privacy and terms describe the current implementation and still need legal review before public distribution.
- Update checks use the fixed public GitHub repository `DarkRanger-wk/Vexlor-Control-Center`. Checks run at startup and every six hours when enabled in Settings, or manually from the top bar. The top-bar button always checks the latest release and, when available, downloads and installs its verified Windows `.exe` after the user's click.

## Data and network

Games, notes and settings are stored in `vcc-data.json` inside Electron's per-user application data folder. System and process data are read locally and kept in memory. There is no telemetry or diagnostics upload. A manual or enabled automatic update check contacts the fixed public GitHub repository and sends ordinary connection metadata such as the IP address.

## Update setup

Every push to `main` builds the Windows NSIS installer, increments the patch version and publishes a new GitHub Release. GitHub Actions must have permission to write repository contents.

The in-app updater installs into the directory of the currently running executable. This keeps the executable path stable for existing taskbar pins; settings and other local data remain in the per-user application data folder.
