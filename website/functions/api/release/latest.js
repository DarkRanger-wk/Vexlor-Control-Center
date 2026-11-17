const repository = 'DarkRanger-wk/Vexlor-Control-Center';

export async function onRequestGet() {
  try {
    const response = await fetch(`https://api.github.com/repos/${repository}/releases/latest`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Vexlor-Control-Center-Website',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}`);

    const release = await response.json();
    const asset = Array.isArray(release.assets)
      ? release.assets.find((entry) => typeof entry?.name === 'string' && entry.name.toLowerCase().endsWith('.exe'))
      : null;
    const validUrl = typeof asset?.browser_download_url === 'string'
      && new URL(asset.browser_download_url).origin === 'https://github.com';

    return Response.json({
      version: typeof release.tag_name === 'string' ? release.tag_name : null,
      publishedAt: typeof release.published_at === 'string' ? release.published_at : null,
      htmlUrl: typeof release.html_url === 'string' ? release.html_url : null,
      notes: typeof release.body === 'string' ? release.body : '',
      installer: asset && validUrl ? {
        name: asset.name,
        url: asset.browser_download_url,
      } : null,
    });
  } catch (error) {
    return Response.json({
      error: 'Release information is temporarily unavailable.',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 502 });
  }
}
