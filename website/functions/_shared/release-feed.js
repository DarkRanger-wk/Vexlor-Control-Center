const repository = 'DarkRanger-wk/Vexlor-Control-Center';
const feedUrl = `https://github.com/${repository}/releases.atom`;

function decodeEntities(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code) => {
    if (code[0] === '#') {
      const number = code[1].toLowerCase() === 'x'
        ? Number.parseInt(code.slice(2), 16)
        : Number.parseInt(code.slice(1), 10);
      return Number.isInteger(number) && number >= 0 && number <= 0x10ffff
        ? String.fromCodePoint(number)
        : entity;
    }

    return {
      amp: '&',
      lt: '<',
      gt: '>',
      quot: '"',
      apos: "'",
      nbsp: ' ',
    }[code.toLowerCase()] || entity;
  });
}

function getElementText(source, name) {
  const match = source.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return match ? decodeEntities(match[1].trim()) : '';
}

function getReleaseNotes(content) {
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
      && !/^Änderungen$/i.test(line)
      && !/^Änderungen in Version .+:\s*$/i.test(line))
    .join('\n');
}

function parseRelease(entry) {
  const linkTag = entry.match(/<link\b[^>]*>/i)?.[0] || '';
  const relation = linkTag.match(/\brel=["']([^"']+)["']/i)?.[1];
  const href = linkTag.match(/\bhref=["']([^"']+)["']/i)?.[1];
  if (relation !== 'alternate' || !href) return null;

  const releaseUrl = new URL(decodeEntities(href));
  const version = releaseUrl.pathname.match(/^\/[^/]+\/[^/]+\/releases\/tag\/([^/]+)$/)?.[1];
  if (releaseUrl.origin !== 'https://github.com' || !version) return null;

  const publishedAt = getElementText(entry, 'updated');
  const notes = getReleaseNotes(getElementText(entry, 'content'));
  return {
    version: decodeURIComponent(version),
    name: getElementText(entry, 'title'),
    publishedAt: publishedAt || null,
    htmlUrl: releaseUrl.href,
    notes,
  };
}

export async function getGitHubReleases() {
  const response = await fetch(feedUrl, {
    headers: {
      Accept: 'application/atom+xml, application/xml',
      'User-Agent': 'Vexlor-Control-Center-Website',
    },
    signal: AbortSignal.timeout(10000),
    cf: { cacheTtl: 300, cacheEverything: true },
  });
  if (!response.ok) throw new Error(`GitHub release feed returned HTTP ${response.status}`);

  const feed = await response.text();
  const releases = [...feed.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)]
    .map((match) => parseRelease(match[1]))
    .filter(Boolean);
  if (!releases.length) throw new Error('GitHub release feed contained no valid releases');

  return releases;
}
