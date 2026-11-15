import type { IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export function assertTrustedRenderer(event: IpcMainInvokeEvent): void {
  const senderUrl = event.senderFrame?.url
  if (!senderUrl) throw new Error('Nicht autorisierte IPC-Anfrage.')

  const developmentUrl = process.env.ELECTRON_RENDERER_URL
  if (developmentUrl) {
    try {
      const sender = new URL(senderUrl)
      const expected = new URL(developmentUrl)
      if (sender.origin === expected.origin && sender.pathname === '/') return
    } catch {
      throw new Error('Nicht autorisierte IPC-Anfrage.')
    }
  } else if (senderUrl === pathToFileURL(join(__dirname, '../renderer/index.html')).href) {
    return
  }

  throw new Error('Nicht autorisierte IPC-Anfrage.')
}

export function assertNoArgs(args: unknown[]): void {
  if (args.length !== 0) throw new Error('Ungültige IPC-Daten.')
}

export function assertRecord(value: unknown): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Ungültige IPC-Daten.')
  }
}

export function assertString(value: unknown, name: string, maxLength: number): asserts value is string {
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new Error(`Ungültige Eingabe: ${name}.`)
  }
}
