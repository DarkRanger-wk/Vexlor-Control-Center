import { contextBridge, ipcRenderer } from 'electron'
import type { TimerWidgetAction, TimerWidgetState } from '../../src/types/app'

let latestState: TimerWidgetState | null = null
let stateCallback: ((state: TimerWidgetState) => void) | null = null

ipcRenderer.on('timer-widget:state', (_event, state: TimerWidgetState) => {
  latestState = state
  stateCallback?.(state)
})

contextBridge.exposeInMainWorld('vccTimerWidget', {
  onState(callback: (state: TimerWidgetState) => void) {
    stateCallback = callback
    if (latestState) callback(latestState)
    return () => {
      if (stateCallback === callback) stateCallback = null
    }
  },
  action(action: TimerWidgetAction) {
    ipcRenderer.send('timer-widget:action', action)
  },
})
