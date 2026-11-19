import { getGitHubReleases } from '../_shared/release-feed.js';

export async function onRequestGet() {
  try {
    const releases = await getGitHubReleases();

    return Response.json(releases, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' },
    });
  } catch (error) {
    console.error('Release history fetch failed:', error);
    return Response.json({
      error: 'Release history is temporarily unavailable.',
    }, { status: 502 });
  }
}
