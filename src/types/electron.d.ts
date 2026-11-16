import type { TimerWidgetState, VccApi } from './app'

interface ScreenshotOverlayApi {
  onInitialize(callback: (payload: { image: string }) => void): () => void
  complete(rect: { x: number; y: number; width: number; height: number }): void
  cancel(): void
}

interface FloatingTimerWidgetApi {
  onState(callback: (state: TimerWidgetState) => void): () => void
  action(action: 'open-app' | 'timer-toggle' | 'timer-reset' | 'stopwatch-toggle' | 'stopwatch-reset'): void
}

declare global {
  interface Window {
    vcc: VccApi
    vccScreenshotOverlay: ScreenshotOverlayApi
    vccTimerWidget: FloatingTimerWidgetApi
  }
}

export {}
