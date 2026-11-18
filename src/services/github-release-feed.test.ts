import assert from 'node:assert/strict'
import test from 'node:test'
import { parseGitHubReleaseFeed } from './github-release-feed.ts'

test('parses release metadata and decodes GitHub release notes', () => {
  const feed = `<feed>
    <entry>
      <updated>2026-11-18T12:00:00Z</updated>
      <link rel="alternate" href="https://github.com/DarkRanger-wk/Vexlor-Control-Center/releases/tag/v0.1.8"/>
      <title>Vexlor Control Center 0.1.8</title>
      <content type="html">&lt;p&gt;Änderungen in Version 0.1.8:&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Fehler &amp;amp; Verbesserungen&lt;/li&gt;&lt;/ul&gt;</content>
    </entry>
  </feed>`

  assert.deepEqual(parseGitHubReleaseFeed(feed), [{
    version: 'v0.1.8',
    name: 'Vexlor Control Center 0.1.8',
    publishedAt: '2026-11-18T12:00:00Z',
    htmlUrl: 'https://github.com/DarkRanger-wk/Vexlor-Control-Center/releases/tag/v0.1.8',
    notes: '- Fehler & Verbesserungen',
  }])
})

test('ignores non-repository entries and generated empty changelog notes', () => {
  const feed = `<feed>
    <entry>
      <updated>2026-11-18T12:00:00Z</updated>
      <link rel="alternate" href="https://example.com/releases/tag/v0.1.8"/>
      <title>Untrusted release</title>
      <content>No content.</content>
    </entry>
    <entry>
      <updated>2026-11-18T12:00:00Z</updated>
      <link rel="alternate" href="https://github.com/DarkRanger-wk/Vexlor-Control-Center/releases/tag/v0.1.7"/>
      <title>Vexlor Control Center 0.1.7</title>
      <content type="html">&lt;p&gt;&lt;strong&gt;Full Changelog&lt;/strong&gt;: &lt;a href=&quot;https://github.com/example&quot;&gt;compare&lt;/a&gt;&lt;/p&gt;</content>
    </entry>
  </feed>`

  const [release] = parseGitHubReleaseFeed(feed)
  assert.equal(release.version, 'v0.1.7')
  assert.equal(release.notes, '')
})
