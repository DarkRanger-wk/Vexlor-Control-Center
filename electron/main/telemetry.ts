import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

const telemetryUrl = 'https://infos-vcc.pages.dev/api/telemetry/event'
const queueDir = join(app.getPath('userData'), 'telemetry')
const queueFile = join(queueDir, 'queue.json')
const installFile = join(queueDir, 'install-id.txt')

interface TelemetryEvent {
  installId: string
  eventId: string
  eventType: 'app.started' | 'app.stopped' | 'session.started' | 'heartbeat' | 'session.ended' | 'consent.revoked'
  sessionId?: string
  appVersion: string
  platform: string
}

let telemetryEnabled = false
let currentInstallId: string | null = null
let currentSessionId: string | null = null
let heartbeat: NodeJS.Timeout | null = null
let flushInProgress = false
let flushRequested = false

function getInstallId(): string {
  if (currentInstallId) return currentInstallId
  mkdirSync(queueDir, { recursive: true })
  if (existsSync(installFile)) {
    const savedId = readFileSync(installFile, 'utf8').trim()
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[4-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(savedId)) {
      currentInstallId = savedId
      return savedId
    }
    throw new Error('Die lokale Telemetrie-Kennung ist ungültig.')
  }

  currentInstallId = randomUUID()
  writeFileSync(installFile, currentInstallId, 'utf8')
  return currentInstallId
}

function readQueue(): TelemetryEvent[] {
  if (!existsSync(queueFile)) return []
  const parsed: unknown = JSON.parse(readFileSync(queueFile, 'utf8'))
  if (!Array.isArray(parsed)) throw new Error('Die lokale Telemetrie-Warteschlange hat ein ungültiges Format.')
  return parsed as TelemetryEvent[]
}

function writeQueue(events: TelemetryEvent[]): void {
  mkdirSync(queueDir, { recursive: true })
  const temporaryFile = `${queueFile}.tmp`
  writeFileSync(temporaryFile, JSON.stringify(events), 'utf8')
  renameSync(temporaryFile, queueFile)
}

function forgetInstallId(installId: string): void {
  if (currentInstallId === installId) currentInstallId = null
  if (existsSync(installFile) && readFileSync(installFile, 'utf8').trim() === installId) {
    rmSync(installFile, { force: true })
  }
}

function createEvent(eventType: TelemetryEvent['eventType'], sessionId?: string): TelemetryEvent {
  const event: TelemetryEvent = {
    installId: getInstallId(),
    eventId: randomUUID(),
    eventType,
    appVersion: app.getVersion(),
    platform: process.platform,
  }
  if (sessionId) event.sessionId = sessionId
  return event
}

function enqueue(event: TelemetryEvent): void {
  const queue = readQueue()
  queue.push(event)
  writeQueue(queue)
}

async function postEvent(event: TelemetryEvent): Promise<boolean> {
  try {
    const response = await fetch(telemetryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(8000),
    })
    if (response.ok) return true
    console.warn(`Optional VCC telemetry was not accepted (HTTP ${response.status}).`)
  } catch (error) {
    console.warn('Optional VCC telemetry is offline; events remain queued.', error)
  }
  return false
}

async function flushQueue(): Promise<void> {
  if (flushInProgress) {
    flushRequested = true
    return
  }
  flushInProgress = true
  try {
    const queuedEvents = readQueue()
    const sentIds = new Set<string>()
    for (const event of queuedEvents) {
      if (!await postEvent(event)) break
      sentIds.add(event.eventId)
      if (event.eventType === 'consent.revoked') {
        forgetInstallId(event.installId)
      }
    }
    if (sentIds.size > 0) writeQueue(readQueue().filter((event) => !sentIds.has(event.eventId)))
  } finally {
    flushInProgress = false
    if (flushRequested) {
      flushRequested = false
      void flushQueue()
    }
  }
}

function emit(eventType: TelemetryEvent['eventType'], sessionId?: string): void {
  enqueue(createEvent(eventType, sessionId))
  void flushQueue()
}

function startSession(): void {
  if (!telemetryEnabled) return
  const installId = getInstallId()
  currentSessionId = randomUUID()
  enqueue({
    installId,
    eventId: randomUUID(),
    eventType: 'app.started',
    appVersion: app.getVersion(),
    platform: process.platform,
  })
  emit('session.started', currentSessionId)
  heartbeat = setInterval(() => {
    if (currentSessionId) emit('heartbeat', currentSessionId)
  }, 60_000)
}

export function setTelemetryEnabled(enabled: boolean): void {
  if (telemetryEnabled === enabled) return
  if (enabled) {
    telemetryEnabled = true
    void flushQueue()
    startSession()
    return
  }

  telemetryEnabled = false
  if (heartbeat) clearInterval(heartbeat)
  heartbeat = null
  const installId = currentInstallId
  currentSessionId = null
  if (!installId) return

  const pendingRevocations = readQueue().filter((event) => event.eventType === 'consent.revoked')
  writeQueue([...pendingRevocations, {
    installId,
    eventId: randomUUID(),
    eventType: 'consent.revoked',
    appVersion: app.getVersion(),
    platform: process.platform,
  }])
  forgetInstallId(installId)
  void flushQueue()
}

export function registerTelemetryLifecycle(enabled: boolean): void {
  if (enabled) setTelemetryEnabled(true)
  void flushQueue()

  app.on('before-quit', () => {
    if (!telemetryEnabled || !currentSessionId) return
    if (heartbeat) clearInterval(heartbeat)
    heartbeat = null
    enqueue(createEvent('session.ended', currentSessionId))
    enqueue(createEvent('app.stopped'))
    currentSessionId = null
    void flushQueue()
  })
}
