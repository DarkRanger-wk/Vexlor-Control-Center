import type { VccApi } from './app'

declare global {
  interface Window {
    vcc: VccApi
  }
}

export {}
