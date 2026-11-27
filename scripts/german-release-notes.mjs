import { pathToFileURL } from 'node:url'

const translations = new Map([
  ['feat: enable default telemetry and update app preview', 'Nutzungsstatistiken sind bei Neuinstallationen standardmäßig aktiviert; die Website-Vorschau wurde erweitert.'],
  ['feat: spielhalle und admin-bereich erweitern', 'Spielhalle um passende Szenen und spielbezogene Erfolge erweitert; der Admin-Bereich zeigt App-Nutzer mit Online-Status und behält Anmeldungen bis zu einem Update.'],
  ['fix: repair system snapshot and arcade profile storage', 'Fehler in der Systemübersicht und der Speicherung des Arcade-Profils behoben.'],
  ['feat: publish vexlor website and opt-in telemetry', 'Vexlor-Website und optionale Nutzungsstatistiken veröffentlicht.'],
  ['fix: preserve install location during updates', 'Installationsort bei Updates beibehalten.'],
  ['feat: add screenshot and floating timer tools', 'Screenshot-Werkzeug und schwebendes Timer-Fenster hinzugefügt.'],
  ['ci: automate github releases', 'GitHub-Veröffentlichungen automatisiert.'],
  ['fix: disable implicit publishing during installer build', 'Unbeabsichtigte Veröffentlichung beim Erstellen des Installers deaktiviert.'],
])

function translateSubject(subject) {
  const normalized = subject.trim().toLowerCase()
  const exactTranslation = translations.get(normalized)
  if (exactTranslation) return exactTranslation

  throw new Error(`Für den Committitel fehlt eine deutsche Versionshinweis-Übersetzung: ${subject}`)
}

export function createGermanReleaseNotes(version, subjects) {
  if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)) {
    throw new Error('Release version must be a semantic version.')
  }
  if (subjects.length === 0) {
    throw new Error('Für den Release wurden keine konkreten Änderungen gefunden.')
  }

  const changes = subjects.map((subject) => `- ${translateSubject(subject)}`)

  return [`Änderungen in Version ${version}:`, '', ...changes].join('\n')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , version, ...subjects] = process.argv
  process.stdout.write(`${createGermanReleaseNotes(version ?? '', subjects)}\n`)
}
