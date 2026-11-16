import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(projectRoot, 'electron/main/index.ts'),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(projectRoot, 'electron/preload/index.ts'),
          screenshot: resolve(projectRoot, 'electron/preload/screenshot.ts'),
          timerWidget: resolve(projectRoot, 'electron/preload/timer-widget.ts'),
        },
      },
    },
  },
  renderer: {
    root: projectRoot,
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(projectRoot, 'index.html'),
          screenshotOverlay: resolve(projectRoot, 'screenshot-overlay.html'),
          timerWidget: resolve(projectRoot, 'timer-widget.html'),
        },
      },
    },
  },
})
