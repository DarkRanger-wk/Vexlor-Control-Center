import test from 'node:test'
import assert from 'node:assert/strict'
import { createGermanReleaseNotes } from './german-release-notes.mjs'

test('translates known English commit subjects into detailed German notes', () => {
  assert.equal(
    createGermanReleaseNotes('0.2.4', [
      'feat: enable default telemetry and update app preview',
      'fix: repair system snapshot and arcade profile storage',
    ]),
    'Änderungen in Version 0.2.4:\n\n- Nutzungsstatistiken sind bei Neuinstallationen standardmäßig aktiviert; die Website-Vorschau wurde erweitert.\n- Fehler in der Systemübersicht und der Speicherung des Arcade-Profils behoben.',
  )
})

test('keeps unknown commit subjects German by using their translated category', () => {
  assert.equal(
    createGermanReleaseNotes('0.2.5', ['feat(settings): add color controls']),
    'Änderungen in Version 0.2.5:\n\n- Neue Funktionen und Verbesserungen',
  )
})

test('uses a German fallback when a release has no commit subjects', () => {
  assert.equal(
    createGermanReleaseNotes('0.2.5', []),
    'Änderungen in Version 0.2.5:\n\n- Fehlerbehebungen und Verbesserungen',
  )
})

test('rejects invalid release versions', () => {
  assert.throws(() => createGermanReleaseNotes('v0.2.5', []), /semantic version/)
})
