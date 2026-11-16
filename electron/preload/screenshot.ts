import { contextBridge, ipcRenderer } from 'electron'

let initializedPayload: { image: string } | null = null
let initializeCallback: ((payload: { image: string }) => void) | null = null

ipcRenderer.on('screenshot:overlay:init', (_event, payload: { image: string }) => {
  initializedPayload = payload
  initializeCallback?.(payload)
})

contextBridge.exposeInMainWorld('vccScreenshotOverlay', {
  onInitialize(callback: (payload: { image: string }) => void) {
    initializeCallback = callback
    if (initializedPayload) callback(initializedPayload)
    return () => {
      if (initializeCallback === callback) initializeCallback = null
    }
  },
  complete(rect: { x: number; y: number; width: number; height: number }) {
    ipcRenderer.send('screenshot:overlay-complete', rect)
  },
  cancel() {
    ipcRenderer.send('screenshot:overlay-cancel')
  },
})
