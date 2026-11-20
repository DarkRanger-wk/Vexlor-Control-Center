import { app, safeStorage } from 'electron'
import { randomBytes, randomUUID } from 'node:crypto'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface TicketIdentity {
  installId: string
  token: string
}

interface StoredTicketIdentity {
  installId: string
  encryptedToken: string
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[4-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const tokenPattern = /^[A-Za-z0-9_-]{40,64}$/

function identityPath(): string {
  return join(app.getPath('userData'), 'ticket-identity.json')
}

export function hasTicketIdentity(): boolean {
  return existsSync(identityPath())
}

export function getTicketIdentity(): TicketIdentity {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Der sichere Windows-Speicher ist nicht verfügbar. Ticketzugriff wurde nicht gestartet.')
  }
  const file = identityPath()
  if (existsSync(file)) {
    let parsed: unknown
    try {
      parsed = JSON.parse(readFileSync(file, 'utf8'))
    } catch {
      throw new Error('Die lokale Ticket-Identität ist beschädigt und konnte nicht gelesen werden.')
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('Die lokale Ticket-Identität hat ein ungültiges Format.')
    }
    const stored = parsed as Partial<StoredTicketIdentity>
    if (typeof stored.installId !== 'string' || !uuidPattern.test(stored.installId)
      || typeof stored.encryptedToken !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(stored.encryptedToken)) {
      throw new Error('Die lokale Ticket-Identität hat ein ungültiges Format.')
    }
    let token: string
    try {
      token = safeStorage.decryptString(Buffer.from(stored.encryptedToken, 'base64'))
    } catch {
      throw new Error('Die lokale Ticket-Identität konnte nicht entschlüsselt werden.')
    }
    if (!tokenPattern.test(token)) throw new Error('Das lokale Ticket-Geheimnis ist ungültig.')
    return { installId: stored.installId, token }
  }

  const identity: TicketIdentity = {
    installId: randomUUID(),
    token: randomBytes(32).toString('base64url'),
  }
  const stored: StoredTicketIdentity = {
    installId: identity.installId,
    encryptedToken: safeStorage.encryptString(identity.token).toString('base64'),
  }
  const temporary = `${file}.tmp`
  writeFileSync(temporary, JSON.stringify(stored), { encoding: 'utf8', mode: 0o600 })
  renameSync(temporary, file)
  return identity
}
