import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { mkdtemp, open, rm, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { app, shell } from 'electron'
import type { UpdateInfo } from '../../src/types/app'

const updateRepository = 'DarkRanger-wk/Vexlor-Control-Center'
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
  const response = await fetch(`https://api.github.com/repos/${updateRepository}/releases/latest`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Vexlor-Control-Center',
    },
    signal: AbortSignal.timeout(10000),
  })

  if (response.status === 404) throw new Error('Für dieses Repository wurde kein veröffentlichtes GitHub-Release gefunden.')
  if (!response.ok) throw new Error(`GitHub konnte nicht abgefragt werden (HTTP ${response.status}).`)

  const release: unknown = await response.json()
  if (typeof release !== 'object' || release === null || Array.isArray(release)) {
    throw new Error('GitHub hat keine gültigen Release-Informationen zurückgegeben.')
  }

  const data = release as { tag_name?: unknown; html_url?: unknown; body?: unknown; published_at?: unknown; assets?: unknown }
  if (typeof data.tag_name !== 'string' || typeof data.html_url !== 'string') {
    throw new Error('Das GitHub-Release enthält keine gültige Version.')
  }

  const releaseUrl = new URL(data.html_url)
  if (releaseUrl.origin !== 'https://github.com' || releaseUrl.pathname.split('/').slice(1, 3).join('/').toLowerCase() !== updateRepository.toLowerCase()) {
    throw new Error('GitHub hat eine unerwartete Release-Adresse zurückgegeben.')
  }

  let installer: { url: string; name: string } | null = null
  if (Array.isArray(data.assets)) {
    const candidates = data.assets.filter((asset): asset is { name: string; browser_download_url: string } =>
      typeof asset === 'object'
      && asset !== null
      && 'name' in asset
      && typeof asset.name === 'string'
      && asset.name.toLowerCase().endsWith('.exe')
      && 'browser_download_url' in asset
      && typeof asset.browser_download_url === 'string',
    )
    const candidate = candidates.find((asset) => /setup|installer/i.test(asset.name)) ?? candidates[0]
    if (candidate) {
      const installerUrl = new URL(candidate.browser_download_url)
      const segments = installerUrl.pathname.split('/').filter(Boolean)
      if (
        installerUrl.origin === 'https://github.com'
        && segments.slice(0, 2).join('/').toLowerCase() === updateRepository.toLowerCase()
        && segments[2] === 'releases'
        && segments[3] === 'download'
        && segments[4] === data.tag_name
        && segments.length >= 6
      ) {
        installer = { url: installerUrl.href, name: candidate.name }
        installerDownloads.set(data.tag_name, installer)
      }
    }
  }

  const currentVersion = app.getVersion()
  return {
    currentVersion,
    latestVersion: data.tag_name,
    updateAvailable: isNewer(data.tag_name, currentVersion),
    releaseUrl: releaseUrl.href,
    downloadUrl: installer?.url ?? null,
    installerName: installer?.name ?? null,
    notes: typeof data.body === 'string' ? data.body.slice(0, 20000) : '',
    publishedAt: typeof data.published_at === 'string' ? data.published_at : null,
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
      const installerProcess = spawn(installerPath, ['/S'], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        cwd: dirname(process.execPath),
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
