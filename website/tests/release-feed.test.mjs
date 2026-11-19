import test from 'node:test';
import assert from 'node:assert/strict';
import { getGitHubReleases } from '../functions/_shared/release-feed.js';

test('release feed uses the published version and cleans the heading from notes', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.equal(url, 'https://github.com/DarkRanger-wk/Vexlor-Control-Center/releases.atom');
    return new Response(`<?xml version="1.0"?>
      <feed>
        <entry>
          <updated>2026-11-19T18:20:27Z</updated>
          <link rel="alternate" href="https://github.com/DarkRanger-wk/Vexlor-Control-Center/releases/tag/v0.2.1" />
          <title>Vexlor Control Center v0.2.1</title>
          <content type="html">&lt;h2&gt;Änderungen&lt;/h2&gt;&lt;ul&gt;&lt;li&gt;Admin-Bereich abgesichert&lt;/li&gt;&lt;/ul&gt;</content>
        </entry>
      </feed>`, { headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' } });
  };

  try {
    const [release] = await getGitHubReleases();
    assert.equal(release.version, 'v0.2.1');
    assert.equal(release.name, 'Vexlor Control Center v0.2.1');
    assert.equal(release.publishedAt, '2026-11-19T18:20:27Z');
    assert.equal(release.notes, '- Admin-Bereich abgesichert');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
