import { execFile } from 'node:child_process'
import { cpus, freemem, networkInterfaces, release, totalmem } from 'node:os'
import { promisify } from 'node:util'
import { app } from 'electron'
import type { DiskInfo, NetworkSnapshot, ProcessEntry, SystemSnapshot } from '../../src/types/app'

const execFileAsync = promisify(execFile)

interface ProbeProcess {
  Id: number
  ProcessName: string
  CPU: number | null
  WorkingSet64: number
}

interface ProbeAdapter {
  Name: string
  InterfaceDescription: string
  Status: string
  LinkSpeed: string
}

interface ProbeNetworkStats {
  Name: string
  ReceivedBytes: number
  SentBytes: number
}

interface ProbeDisk {
  DeviceID: string
  Size: number | null
  FreeSpace: number | null
}

interface ProbeResult {
  processes: ProbeProcess[]
  adapters: ProbeAdapter[]
  networkStats: ProbeNetworkStats[]
  disks: ProbeDisk[]
  gpus: string[]
}

const probeScript = [
  '[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding',
  '$OutputEncoding = [Console]::OutputEncoding',
  "$ErrorActionPreference = 'Stop'",
  '$processes = @(Get-Process | Select-Object @{n="Id";e={$_.Id}}, @{n="ProcessName";e={$_.ProcessName}}, @{n="CPU";e={$_.CPU}}, @{n="WorkingSet64";e={$_.WorkingSet64}})',
  '$adapters = @()',
  'if (Get-Command Get-NetAdapter -ErrorAction SilentlyContinue) { $adapters = @(Get-NetAdapter -ErrorAction SilentlyContinue | Where-Object Status -eq "Up" | Select-Object Name, InterfaceDescription, Status, LinkSpeed) }',
  '$networkStats = @()',
  'if (Get-Command Get-NetAdapterStatistics -ErrorAction SilentlyContinue) { $networkStats = @(Get-NetAdapterStatistics -ErrorAction SilentlyContinue | Select-Object Name, ReceivedBytes, SentBytes) }',
  '$disks = @(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID, Size, FreeSpace)',
  '$gpus = @(Get-CimInstance Win32_VideoController | ForEach-Object { $_.Name })',
  '[pscustomobject]@{processes=$processes; adapters=$adapters; networkStats=$networkStats; disks=$disks; gpus=$gpus} | ConvertTo-Json -Compress -Depth 4',
].join('; ')

let probePromise: Promise<ProbeResult> | undefined
let probeAt = 0
let cachedProbe: ProbeResult | undefined
let cachedProcesses: ProcessEntry[] = []
let previousProcessCpu = new Map<number, number>()
let previousProcessSampleAt = 0
let previousNetwork = new Map<string, { received: number; sent: number }>()
let previousNetworkSampleAt = 0

function normalizeArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

async function getProbe(): Promise<ProbeResult> {
  if (cachedProbe && Date.now() - probeAt < 1500) return cachedProbe
  if (probePromise) return probePromise

  probePromise = execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', probeScript],
    { timeout: 10000, maxBuffer: 8 * 1024 * 1024, windowsHide: true },
  ).then(({ stdout }) => {
    const result = JSON.parse(stdout) as ProbeResult
    result.processes = normalizeArray(result.processes)
    result.adapters = normalizeArray(result.adapters)
    result.networkStats = normalizeArray(result.networkStats)
    result.disks = normalizeArray(result.disks)
    result.gpus = normalizeArray(result.gpus)
    cachedProbe = result
    probeAt = Date.now()
    return result
  }).finally(() => {
    probePromise = undefined
  })

  return probePromise
}

function getLocalAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flatMap((interfaces) => interfaces ?? [])
    .filter((entry) => !entry.internal && entry.family === 'IPv4')
    .map((entry) => entry.address)
}

function getProcesses(probe: ProbeResult): ProcessEntry[] {
  const now = Date.now()
  const elapsedSeconds = previousProcessSampleAt > 0 ? (now - previousProcessSampleAt) / 1000 : 0
  const coreCount = Math.max(1, cpus().length)
  const currentCpu = new Map<number, number>()

  cachedProcesses = probe.processes.map((process) => {
    const cpuSeconds = typeof process.CPU === 'number' ? process.CPU : null
    if (cpuSeconds !== null) currentCpu.set(process.Id, cpuSeconds)
    const previous = previousProcessCpu.get(process.Id)
    const cpuPercent = cpuSeconds !== null && previous !== undefined && elapsedSeconds > 0
      ? Math.max(0, Math.min(100, ((cpuSeconds - previous) / elapsedSeconds / coreCount) * 100))
      : null

    return {
      pid: process.Id,
      name: process.ProcessName,
      cpuPercent,
      memoryBytes: process.WorkingSet64,
    }
  })

  previousProcessCpu = currentCpu
  previousProcessSampleAt = now
  return cachedProcesses
}

export async function readSystemSnapshot(): Promise<SystemSnapshot> {
  const [probe, cpuList] = await Promise.all([getProbe(), Promise.resolve(cpus())])
  const totalMemory = totalmem()
  const freeMemory = freemem()
  const totalCores = cpuList.reduce((sum, cpu) => sum + Object.values(cpu.times).reduce((a, b) => a + b, 0), 0)
  const idleCores = cpuList.reduce((sum, cpu) => sum + cpu.times.idle, 0)
  const previous = readSystemSnapshotState
  const sampledAt = Date.now()
  let usagePercent: number | null = null

  if (previous.total !== undefined) {
    const totalDelta = totalCores - previous.total
    const idleDelta = idleCores - (previous.idle ?? idleCores)
    if (totalDelta > 0) usagePercent = Math.max(0, Math.min(100, Math.round((1 - idleDelta / totalDelta) * 100)))
  }
  readSystemSnapshotState = { total: totalCores, idle: idleCores, sampledAt }

  const disks: DiskInfo[] = probe.disks
    .filter((disk) => typeof disk.DeviceID === 'string' && typeof disk.Size === 'number' && typeof disk.FreeSpace === 'number')
    .map((disk) => ({ mount: disk.DeviceID, totalBytes: disk.Size!, freeBytes: disk.FreeSpace! }))

  return {
    cpu: { model: cpuList[0]?.model ?? 'Unbekannt', logicalCores: cpuList.length, usagePercent },
    memory: {
      totalBytes: totalMemory,
      usedBytes: totalMemory - freeMemory,
      usagePercent: totalMemory > 0 ? Math.round(((totalMemory - freeMemory) / totalMemory) * 100) : null,
    },
    gpus: probe.gpus.filter((gpu) => typeof gpu === 'string' && gpu.trim().length > 0),
    operatingSystem: { name: 'Windows', version: release(), architecture: process.arch },
    disks,
    sampledAt: new Date(sampledAt).toISOString(),
    appVersion: app.getVersion(),
  }
}

let readSystemSnapshotState: { total?: number; idle?: number; sampledAt?: number } = {}

export async function readProcessList(): Promise<ProcessEntry[]> {
  return getProcesses(await getProbe())
}

export async function readNetworkSnapshot(): Promise<NetworkSnapshot> {
  const probe = await getProbe()
  const currentStats = new Map(probe.networkStats.map((stat) => [
    stat.Name,
    { received: stat.ReceivedBytes, sent: stat.SentBytes },
  ]))
  const activeAdapter = probe.adapters[0]
  const now = Date.now()
  const elapsedSeconds = previousNetworkSampleAt > 0 ? (now - previousNetworkSampleAt) / 1000 : 0
  let receivedDelta = 0
  let sentDelta = 0
  let hasCounter = false

  for (const [name, stats] of currentStats) {
    const previous = previousNetwork.get(name)
    if (previous && elapsedSeconds > 0) {
      receivedDelta += Math.max(0, stats.received - previous.received)
      sentDelta += Math.max(0, stats.sent - previous.sent)
      hasCounter = true
    }
  }
  previousNetwork = currentStats
  previousNetworkSampleAt = now

  return {
    connected: probe.adapters.length > 0,
    adapterName: activeAdapter?.InterfaceDescription ?? activeAdapter?.Name ?? null,
    connectionType: activeAdapter
      ? /wi-?fi|wireless|wlan/i.test(`${activeAdapter.Name} ${activeAdapter.InterfaceDescription}`) ? 'WLAN' : 'Ethernet'
      : null,
    localAddresses: getLocalAddresses(),
    downloadBytesPerSecond: hasCounter ? Math.round(receivedDelta / elapsedSeconds) : null,
    uploadBytesPerSecond: hasCounter ? Math.round(sentDelta / elapsedSeconds) : null,
    sampledAt: new Date(now).toISOString(),
  }
}

export function readCachedProcesses(): ProcessEntry[] {
  return cachedProcesses
}
