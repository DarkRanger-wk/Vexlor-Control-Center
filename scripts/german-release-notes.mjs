import { pathToFileURL } from 'node:url'

const translations = new Map([
  ['feat: enable default telemetry and update app preview', 'Nutzungsstatistiken sind bei Neuinstallationen standardmäßig aktiviert; die Website-Vorschau wurde erweitert.'],
  ['fix: repair system snapshot and arcade profile storage', 'Fehler in der Systemübersicht und der Speicherung des Arcade-Profils behoben.'],
  ['feat: publish vexlor website and opt-in telemetry', 'Vexlor-Website und optionale Nutzungsstatistiken veröffentlicht.'],
  ['fix: preserve install location during updates', 'Installationsort bei Updates beibehalten.'],
  ['feat: add screenshot and floating timer tools', 'Screenshot-Werkzeug und schwebendes Timer-Fenster hinzugefügt.'],
  ['ci: automate github releases', 'GitHub-Veröffentlichungen automatisiert.'],
  ['fix: disable implicit publishing during installer build', 'Unbeabsichtigte Veröffentlichung beim Erstellen des Installers deaktiviert.'],
])

const categoryLabels = new Map([
  ['feat', 'Neue Funktionen und Verbesserungen'],
  ['feature', 'Neue Funktionen und Verbesserungen'],
  ['fix', 'Fehlerbehebungen'],
  ['bugfix', 'Fehlerbehebungen'],
  ['docs', 'Dokumentation aktualisiert'],
  ['refactor', 'Interne Abläufe verbessert'],
  ['perf', 'Leistung verbessert'],
  ['test', 'Tests aktualisiert'],
  ['ci', 'Build- und Veröffentlichungsabläufe verbessert'],
  ['build', 'Build aktualisiert'],
  ['style', 'Darstellung angepasst'],
  ['chore', 'Wartungsarbeiten durchgeführt'],
  ['revert', 'Änderung zurückgenommen'],
])

function translateSubject(subject) {
  const normalized = subject.trim().toLowerCase()
  const exactTranslation = translations.get(normalized)
  if (exactTranslation) return exactTranslation

  const type = normalized.match(/^([a-z]+)(?:\([^)]*\))?:\s*/)?.[1]
  return categoryLabels.get(type) ?? 'Weitere Verbesserungen'
}

export function createGermanReleaseNotes(version, subjects) {
  if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)) {
    throw new Error('Release version must be a semantic version.')
  }

  const changes = subjects.length > 0
    ? subjects.map((subject) => `- ${translateSubject(subject)}`)
    : ['- Fehlerbehebungen und Verbesserungen']

  return [`Änderungen in Version ${version}:`, '', ...changes].join('\n')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , version, ...subjects] = process.argv
  process.stdout.write(`${createGermanReleaseNotes(version ?? '', subjects)}\n`)
}
