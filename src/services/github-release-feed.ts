export interface GitHubReleaseFeedEntry {
  version: string
  name: string
  publishedAt: string | null
  htmlUrl: string
  notes: string
}

const repository = 'DarkRanger-wk/Vexlor-Control-Center'
const releaseTagPattern = /^v?\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/

function decodeEntities(value: string): string {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code: string) => {
    if (code[0] === '#') {
      const number = code[1].toLowerCase() === 'x'
        ? Number.parseInt(code.slice(2), 16)
        : Number.parseInt(code.slice(1), 10)
      return Number.isInteger(number) && number >= 0 && number <= 0x10ffff
        ? String.fromCodePoint(number)
        : entity
    }

    return {
      amp: '&',
      lt: '<',
      gt: '>',
      quot: '"',
      apos: "'",
      nbsp: ' ',
    }[code.toLowerCase()] ?? entity
  })
}

function getElementText(source: string, name: string): string {
  const match = source.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))
  return match ? decodeEntities(match[1].trim()) : ''
}

function getReleaseNotes(content: string): string {
  return content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<\/(?:p|li|div|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .split(/\r?\n/)
    .map((line) => decodeEntities(line).trim())
    .filter((line) => line
      && !/^full changelog\b/i.test(line)
      && !/^no content\.?$/i.test(line)
      && !/^Änderungen in Version .+:\s*$/i.test(line))
    .join('\n')
}

function parseEntry(entry: string): GitHubReleaseFeedEntry | null {
  const linkTag = entry.match(/<link\b[^>]*>/i)?.[0] ?? ''
  const relation = linkTag.match(/\brel=["']([^"']+)["']/i)?.[1]
  const href = linkTag.match(/\bhref=["']([^"']+)["']/i)?.[1]
  if (relation !== 'alternate' || !href) return null

  let releaseUrl: URL
  try {
    releaseUrl = new URL(decodeEntities(href))
  } catch {
    return null
  }

  const path = releaseUrl.pathname.split('/').filter(Boolean)
  if (releaseUrl.origin !== 'https://github.com'
    || releaseUrl.search
    || releaseUrl.hash
    || path.length !== 5
    || path.slice(0, 2).join('/').toLowerCase() !== repository.toLowerCase()
    || path[2] !== 'releases'
    || path[3] !== 'tag') {
    return null
  }

  let version: string
  try {
    version = decodeURIComponent(path[4])
  } catch {
    return null
  }
  if (!releaseTagPattern.test(version)) return null

  const notes = getReleaseNotes(getElementText(entry, 'content'))
  return {
    version,
    name: getElementText(entry, 'title') || version,
    publishedAt: getElementText(entry, 'updated') || null,
    htmlUrl: releaseUrl.href,
    notes,
  }
}

export function parseGitHubReleaseFeed(feed: string): GitHubReleaseFeedEntry[] {
  return [...feed.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)]
    .map((match) => parseEntry(match[1]))
    .filter((release): release is GitHubReleaseFeedEntry => release !== null)
}
