import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { mkdtemp, open, rm, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { app, shell } from 'electron'
import type { UpdateInfo } from '../../src/types/app'
import { parseGitHubReleaseFeed } from '../../src/services/github-release-feed'

const updateRepository = 'DarkRanger-wk/Vexlor-Control-Center'
const releaseFeedUrl = `https://github.com/${updateRepository}/releases.atom`
const installerDownloads = new Map<string, { url: string; name: string }>()
const maxInstallerBytes = 500 * 1024 * 1024

function parseVersion(value: string): number[] {
  const match = value.trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/)
  if (!match) throw new Error(`Ungültige Versionsnummer: ${value}`)
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function isNewer(latest: string, current: string): boolean {
  const latestParts = parseVersion(latest)
  const currentParts = parseVersion(current)
  for (let index = 0; index < 3; index += 1) {
    if (latestParts[index] !== currentParts[index]) return latestParts[index] > currentParts[index]
  }
  return false
}

async function* readResponseBody(body: ReadableStream<Uint8Array>): AsyncGenerator<Uint8Array> {
  const reader = body.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) return
      yield value
    }
  } finally {
    reader.releaseLock()
  }
}

export async function checkLatestRelease(): Promise<UpdateInfo> {
  const response = await fetch(releaseFeedUrl, {
    headers: {
      Accept: 'application/atom+xml, application/xml',
      'User-Agent': 'Vexlor-Control-Center',
    },
    signal: AbortSignal.timeout(10000),
  })

  if (!response.ok) throw new Error(`GitHub konnte nicht abgefragt werden (HTTP ${response.status}).`)

  const [release] = parseGitHubReleaseFeed(await response.text())
  if (!release) throw new Error('GitHub hat keine gültigen Release-Informationen zurückgegeben.')

  const versionNumber = release.version.match(/^v?(\d+\.\d+\.\d+)$/)?.[1]
  const installer = versionNumber
    ? {
      name: `Vexlor-Control-Center-${versionNumber}-x64.exe`,
      url: `https://github.com/${updateRepository}/releases/download/${encodeURIComponent(release.version)}/Vexlor-Control-Center-${versionNumber}-x64.exe`,
    }
    : null
  if (installer) installerDownloads.set(release.version, installer)

  const currentVersion = app.getVersion()
  return {
    currentVersion,
    latestVersion: release.version,
    updateAvailable: isNewer(release.version, currentVersion),
    releaseUrl: release.htmlUrl,
    downloadUrl: installer?.url ?? null,
    installerName: installer?.name ?? null,
    notes: release.notes.slice(0, 20000),
    publishedAt: release.publishedAt,
  }
}

export async function downloadLatestInstaller(): Promise<UpdateInfo> {
  const latest = await checkLatestRelease()
  if (!latest.updateAvailable || !latest.latestVersion || !latest.downloadUrl) return latest
  const installer = installerDownloads.get(latest.latestVersion)
  if (!installer) throw new Error('Für dieses Release wurde noch kein Windows-Installer geprüft.')

  const response = await fetch(installer.url, {
    headers: {
      Accept: 'application/octet-stream',
      'User-Agent': 'Vexlor-Control-Center',
    },
    signal: AbortSignal.timeout(10 * 60 * 1000),
  })
  if (!response.ok) throw new Error(`Der Installer konnte nicht heruntergeladen werden (HTTP ${response.status}).`)
  const downloadHost = new URL(response.url).hostname
  if (downloadHost !== 'github.com' && downloadHost !== 'githubusercontent.com' && !downloadHost.endsWith('.githubusercontent.com')) {
    throw new Error('GitHub hat den Installer auf einen nicht vertrauenswürdigen Host umgeleitet.')
  }
  if (!response.body) throw new Error('GitHub hat keine Installer-Datei zurückgegeben.')

  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > maxInstallerBytes) {
    throw new Error('Der Installer ist größer als das erlaubte Maximum von 500 MB.')
  }

  const downloadDirectory = await mkdtemp(join(app.getPath('temp'), 'vexlor-update-'))
  const installerPath = join(downloadDirectory, 'vexlor-update.exe')
  let downloadedBytes = 0
  const sizeGuard = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      downloadedBytes += chunk.length
      if (downloadedBytes > maxInstallerBytes) callback(new Error('Der Installer ist größer als das erlaubte Maximum von 500 MB.'))
      else callback(null, chunk)
    },
  })

  try {
    await pipeline(
      Readable.from(readResponseBody(response.body)),
      sizeGuard,
      createWriteStream(installerPath, { flags: 'wx' }),
    )
    const file = await stat(installerPath)
    if (file.size < 1024) throw new Error('Der heruntergeladene Installer ist unvollständig.')
    if (contentLength > 0 && file.size !== contentLength) throw new Error('Der Installer wurde nicht vollständig heruntergeladen.')
    const installerFile = await open(installerPath, 'r')
    try {
      const signature = Buffer.alloc(2)
      const { bytesRead } = await installerFile.read(signature, 0, signature.length, 0)
      if (bytesRead !== 2 || signature.toString('ascii') !== 'MZ') throw new Error('Die heruntergeladene Datei ist kein gültiger Windows-Installer.')
    } finally {
      await installerFile.close()
    }

    await new Promise<void>((resolve, reject) => {
      const installDirectory = dirname(process.execPath)
      const installerProcess = spawn(installerPath, ['/S', `/D=${installDirectory}`], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        cwd: installDirectory,
      })
      installerProcess.once('error', reject)
      installerProcess.once('spawn', () => {
        installerProcess.unref()
        app.quit()
        resolve()
      })
    })
    return latest
  } catch (error) {
    await rm(downloadDirectory, { recursive: true, force: true })
    throw error
  }
}

export async function openGitHubRelease(tag: string): Promise<void> {
  if (!/^v?\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(tag)) {
    throw new Error('Ungültige Release-Adresse.')
  }

  await shell.openExternal(`https://github.com/${updateRepository}/releases/tag/${encodeURIComponent(tag)}`)
}
