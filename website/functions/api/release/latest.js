import { getGitHubReleases } from '../../_shared/release-feed.js';

export async function onRequestGet() {
  try {
    const [release] = await getGitHubReleases();
    const versionNumber = release.version.match(/^v?(\d+\.\d+\.\d+)$/)?.[1];
    const installerName = versionNumber
      ? `Vexlor-Control-Center-${versionNumber}-x64.exe`
      : null;

    return Response.json({
      version: release.version,
      publishedAt: release.publishedAt,
      htmlUrl: release.htmlUrl,
      notes: release.notes,
      installer: installerName ? {
        name: installerName,
        url: `https://github.com/DarkRanger-wk/Vexlor-Control-Center/releases/download/${encodeURIComponent(release.version)}/${encodeURIComponent(installerName)}`,
      } : null,
    }, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' },
    });
  } catch (error) {
    return Response.json({
      error: 'Release information is temporarily unavailable.',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 502 });
  }
}
