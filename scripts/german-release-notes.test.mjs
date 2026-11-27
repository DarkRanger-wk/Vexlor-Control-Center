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

test('describes the 0.2.5 release in detail', () => {
  assert.equal(
    createGermanReleaseNotes('0.2.5', ['feat: spielhalle und admin-bereich erweitern']),
    'Änderungen in Version 0.2.5:\n\n- Spielhalle um passende Szenen und spielbezogene Erfolge erweitert; der Admin-Bereich zeigt App-Nutzer mit Online-Status und behält Anmeldungen bis zu einem Update.',
  )
})

test('rejects unknown subjects and empty releases instead of publishing generic notes', () => {
  assert.throws(() => createGermanReleaseNotes('0.2.5', ['feat(settings): add color controls']), /deutsche Versionshinweis-Übersetzung/)
  assert.throws(() => createGermanReleaseNotes('0.2.5', []), /keine konkreten Änderungen/)
})

test('rejects invalid release versions', () => {
  assert.throws(() => createGermanReleaseNotes('v0.2.5', []), /semantic version/)
})
