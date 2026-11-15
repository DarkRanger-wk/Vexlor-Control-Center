export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toLocaleString('de-DE', { maximumFractionDigits: 1 })} ${units[unitIndex]}`
}

export function formatRate(bytesPerSecond: number | null): string {
  return bytesPerSecond === null ? 'Wird gemessen …' : `${formatBytes(bytesPerSecond)}/s`
}

export function formatPercent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value)} %`
}
