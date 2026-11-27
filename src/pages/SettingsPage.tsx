import { useState } from 'react'
import packageJson from '../../package.json'
import { Icon } from '../components/Icon'
import type { AppSettings, UpdateInfo } from '../types/app'
import { PageIntro } from './LibraryPage'

interface PageProps {
  settings: AppSettings
  updateSettings: (settings: Partial<AppSettings>) => Promise<boolean>
  notifyError: (message: string) => void
  notifyInfo: (message: string) => void
  onNavigate: (page: string) => void
  onUpdateChecked?: (update: UpdateInfo) => void
}

export function SettingsPage({ settings, updateSettings, notifyError, notifyInfo, onNavigate, onUpdateChecked }: PageProps) {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [checking, setChecking] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const checkUpdates = async () => {
    setChecking(true)
    setUpdateInfo(null)
    try {
      const result = await window.vcc.checkUpdates()
      setUpdateInfo(result)
      onUpdateChecked?.(result)
      if (settings.notifications && result.updateAvailable) notifyInfo(`Version ${result.latestVersion} ist auf GitHub verfügbar.`)
      else if (!result.updateAvailable) notifyInfo('VCC ist auf dem neuesten veröffentlichten Stand.')
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Updateprüfung fehlgeschlagen.')
    } finally {
      setChecking(false)
    }
  }

  const openRelease = async () => {
    if (!updateInfo?.latestVersion) return
    try {
      await window.vcc.openRelease(updateInfo.latestVersion)
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Release-Seite konnte nicht geöffnet werden.')
    }
  }

  const downloadInstaller = async () => {
    setDownloading(true)
    notifyInfo('Das neueste Update wird geprüft und bei Verfügbarkeit installiert.')
    try {
      const result = await window.vcc.downloadUpdate()
      setUpdateInfo(result)
      onUpdateChecked?.(result)
      if (!result.updateAvailable) {
        notifyInfo('VCC ist auf dem neuesten Stand.')
      } else if (result.latestVersion && !result.downloadUrl) {
        await window.vcc.openRelease(result.latestVersion)
        notifyInfo(`Version ${result.latestVersion} ist verfügbar. Die Release-Seite wurde geöffnet.`)
      }
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Update konnte nicht installiert werden.')
    } finally {
      setDownloading(false)
    }
  }

  const setAutostart = async (enabled: boolean) => {
    try {
      const saved = await window.vcc.setAutostart(enabled)
      await updateSettings({ launchAtLogin: saved.launchAtLogin })
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Autostart-Einstellung konnte nicht geändert werden.')
    }
  }

  const resetData = async () => {
    if (!window.confirm('Alle lokal gespeicherten Spiele, Notizen und Einstellungen löschen? Die Spieldateien selbst bleiben unverändert.')) return
    try {
      await window.vcc.resetLocalData()
      window.location.reload()
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Lokale Daten konnten nicht gelöscht werden.')
    }
  }

  return <>
    <PageIntro eyebrow="APP KONFIGURATION" title="Einstellungen" description="Allgemeine App-Optionen, Updates, Datenschutz und rechtliche Informationen." />
    <div className="settings-layout">
      <div className="settings-main">
        <section className="settings-card panel" id="allgemein"><SettingHeading icon="settings" title="Allgemein" description="Grundlegende Einstellungen für Vexlor Control Center." /><div className="setting-row"><div><strong>Sprache</strong><small>Deutsch (Standard) · Englisch ist für eine spätere Version vorgesehen.</small></div><span className="setting-value">DEUTSCH</span></div><SettingSwitch title="Automatisch nach Updates suchen" description="Beim App-Start und danach alle 6 Stunden nach VCC-Releases suchen." checked={settings.autoCheckUpdates} onChange={(value) => void updateSettings({ autoCheckUpdates: value })} /><SettingSwitch title="In-App-Updatehinweise" description="Hinweis in der App, wenn ein neueres Release gefunden wird." checked={settings.notifications} onChange={(value) => void updateSettings({ notifications: value })} /><SettingSwitch title="Mit Windows starten" description="VCC bei der Windows-Anmeldung öffnen." checked={settings.launchAtLogin} onChange={(value) => void setAutostart(value)} /></section>

        <section className="settings-card panel" id="gaming"><SettingHeading icon="spark" title="Gaming & Sound" description="Lokales Gaming-Profil und Arcade-Audio konfigurieren." />
          <label className="setting-profile-row"><span><strong>Gaming-Profilname</strong><small>Anzeige auf dem Dashboard und in Gaming-Bereichen.</small></span><input
            key={settings.gamingProfileName}
            defaultValue={settings.gamingProfileName}
            maxLength={40}
            onBlur={(event) => {
              const name = event.target.value.trim()
              if (name && name !== settings.gamingProfileName) void updateSettings({ gamingProfileName: name })
            }}
          /></label>
          <SettingSwitch title="Arcade-Sounds" description="Lautstärke und Arcade-Audio aktivieren." checked={settings.gameSoundEnabled} onChange={(value) => void updateSettings({ gameSoundEnabled: value })} />
          <label className="setting-range-row"><span><strong>Arcade-Lautstärke</strong><small>Wird auch für das lokale Arcade-Profil verwendet.</small></span><input type="range" min="0" max="100" value={Math.round(settings.gameSoundVolume * 100)} onChange={(event) => void updateSettings({ gameSoundVolume: Number(event.target.value) / 100 })} /><b>{Math.round(settings.gameSoundVolume * 100)}%</b></label>
          <div className="setting-actions"><button className="subtle-button" onClick={() => void updateSettings({ gameSoundEnabled: true, gameSoundVolume: 0.35 })}>Sound zurücksetzen</button><button className="subtle-button" onClick={() => void updateSettings({ gamingProfileName: 'Lokales Gaming-Profil' })}>Gaming-Profil zurücksetzen</button></div>
        </section>

        <section className="settings-card panel" id="benachrichtigungen"><SettingHeading icon="spark" title="Benachrichtigungen" description="Steuere App-Hinweise ohne externe Dienste." /><SettingSwitch title="Updatehinweise anzeigen" description="Zeigt verfügbare Releases oben in der App an." checked={settings.notifications} onChange={(value) => void updateSettings({ notifications: value })} /><SettingSwitch title="Automatische Updateprüfung" description="Prüft beim Start und alle sechs Stunden." checked={settings.autoCheckUpdates} onChange={(value) => void updateSettings({ autoCheckUpdates: value })} /></section>

        <section className="settings-card panel" id="zuruecksetzen"><SettingHeading icon="refresh" title="Gezieltes Zurücksetzen" description="Setze einzelne Einstellungen zurück, ohne deine Spiele oder Notizen zu löschen." /><div className="setting-actions"><button className="subtle-button" onClick={() => void updateSettings({ notifications: true, autoCheckUpdates: true })}>Update & Hinweise zurücksetzen</button><button className="subtle-button" onClick={() => void updateSettings({ dashboardElements: { systemStats: true, systemOverview: true, library: true, arcade: true, quickActions: true } })}>Dashboard zurücksetzen</button><button className="subtle-button" onClick={() => void updateSettings({ compactSidebar: false, animations: true })}>Oberfläche zurücksetzen</button></div></section>

        <section className="settings-card panel" id="updates">
          <SettingHeading icon="refresh" title="Updates" description={`Installierte Version ${updateInfo?.currentVersion ?? packageJson.version} · Quelle: DarkRanger-wk/Vexlor-Control-Center.`} />
          <div className="setting-actions">
            <button className="primary-button" disabled={checking || downloading} onClick={() => void checkUpdates()}>{checking ? 'Prüfe GitHub …' : 'Nach Updates suchen'}</button>
            {updateInfo?.updateAvailable && updateInfo.downloadUrl && <button className="primary-button" disabled={downloading} onClick={() => void downloadInstaller()}>{downloading ? 'Update wird installiert …' : 'Update installieren'}</button>}
            {updateInfo?.updateAvailable && <button className="subtle-button" onClick={() => void openRelease()}>Release ansehen</button>}
          </div>
          {updateInfo && <div className={`update-result${updateInfo.updateAvailable ? ' update-found' : ''}`}>
            <div className="update-result-heading">
              <span className={`update-status-icon${updateInfo.updateAvailable ? ' available' : ''}`}><Icon name={updateInfo.updateAvailable ? 'refresh' : 'spark'} /></span>
              <div><strong>{updateInfo.updateAvailable ? `Neue Version ${updateInfo.latestVersion} verfügbar` : `Du bist auf dem neuesten Stand`}</strong><span>Installiert: {updateInfo.currentVersion}{updateInfo.publishedAt ? ` · Veröffentlicht am ${new Date(updateInfo.publishedAt).toLocaleDateString('de-DE')}` : ''}</span></div>
              <span className={`update-status-pill${updateInfo.updateAvailable ? ' available' : ''}`}>{updateInfo.updateAvailable ? 'UPDATE' : 'AKTUELL'}</span>
            </div>
            {updateInfo.notes && <pre>{updateInfo.notes}</pre>}
            <div className="update-download-note">
              <span className="update-download-dot" />
              <small>{updateInfo.downloadUrl ? `„${updateInfo.installerName}“ wird direkt geladen und ohne Setup-Assistent in die bestehende Installation eingespielt. Deine Spiele, Einstellungen und Notizen bleiben erhalten.` : 'Für dieses Release ist kein Windows-Installer angehängt. Auf der Release-Seite findest du verfügbare Dateien.'}</small>
            </div>
          </div>}
        </section>

        <section className="settings-card panel" id="datenschutz"><SettingHeading icon="network" title="Datenschutz & lokale Daten" description="Transparenz und Kontrolle über optionale Nutzungsstatistiken." /><div className="privacy-summary"><p>Spieleinträge, Notizen und Einstellungen werden lokal in einer JSON-Datei im Electron-Benutzerordner gespeichert. Systemwerte werden zur Laufzeit lokal gelesen und nicht dauerhaft gespeichert.</p><p>Updateprüfungen fragen die GitHub-Releases-API ab. GitHub erhält dabei übliche Verbindungsmetadaten. Ein Installer wird erst nach deinem Klick geladen. Bei neuen Installationen sind Nutzungsstatistiken standardmäßig aktiviert.</p><p>Solange die Erfassung aktiviert ist, sendet VCC eine zufällige Installationskennung, App-Version, Plattform sowie Start-, End- und Heartbeat-Zeitpunkte an die Vexlor-Website, um aggregierte Nutzungsstatistiken zu berechnen. Es werden keine Passwörter, Dateien oder System-/Bildschirminhalte übermittelt. Cloudflare verarbeitet bei der Verbindung übliche Netzwerkdaten wie die IP-Adresse. Du kannst die Erfassung jederzeit hier ausschalten; dabei wird auch die zugehörige Statistik-Kennung zur Löschung übermittelt.</p><p>Lokale Daten bleiben bis zur Löschung in der App oder manuellen Entfernung erhalten. Deinstallation kann Benutzerdatenordner unberührt lassen.</p></div><SettingSwitch title="Optionale Nutzungsstatistiken senden" description="Bei neuen Installationen standardmäßig aktiviert. Nur pseudonyme Installations-, Versions- und Sitzungszeitdaten; jederzeit ausschaltbar." checked={settings.telemetryEnabled} onChange={(value) => void updateSettings({ telemetryEnabled: value })} /><div className="setting-actions"><button className="subtle-button" onClick={() => onNavigate('Datenschutzerklärung')}>Datenschutzerklärung lesen</button><button className="danger-button" onClick={() => void resetData()}>Alle lokalen App-Daten löschen</button></div></section>

        <section className="settings-card panel" id="ueber"><SettingHeading icon="spark" title="Über Vexlor Control Center" description={`VCC · Version ${packageJson.version} · Windows-Desktop-Anwendung.`} /><p className="about-copy">Dein lokales Control Center für Systemübersicht, Spiele und Gaming-Werkzeuge.</p><div className="legal-link-row"><button onClick={() => onNavigate('Impressum')}>Impressum <Icon name="arrow" /></button><button onClick={() => onNavigate('Datenschutzerklärung')}>Datenschutzerklärung <Icon name="arrow" /></button><button onClick={() => onNavigate('Nutzungsbedingungen')}>Nutzungsbedingungen <Icon name="arrow" /></button></div><button className="text-button contact-button" onClick={() => void window.vcc.openEmail()}>Kontakt: kontakt.noah224@gmail.com <Icon name="arrow" /></button></section>
      </div>
      <aside className="settings-aside panel"><div className="section-kicker">DIREKT ZU</div>{[['Allgemein', 'allgemein'], ['Gaming & Sound', 'gaming'], ['Benachrichtigungen', 'benachrichtigungen'], ['Zurücksetzen', 'zuruecksetzen'], ['Updates', 'updates'], ['Datenschutz', 'datenschutz'], ['Über VCC', 'ueber']].map(([label, id]) => <a href={`#${id}`} key={id}>{label}<Icon name="arrow" /></a>)}<div className="aside-divider" /><span>THEMEN</span><button onClick={() => onNavigate('Customization')}>Customization <Icon name="arrow" /></button><button onClick={() => onNavigate('Impressum')}>Impressum <Icon name="arrow" /></button><button onClick={() => onNavigate('Datenschutzerklärung')}>Datenschutz <Icon name="arrow" /></button><button onClick={() => onNavigate('Nutzungsbedingungen')}>Nutzungsbedingungen <Icon name="arrow" /></button></aside>
    </div>
  </>
}

export function AboutPage({ onNavigate }: Pick<PageProps, 'onNavigate'>) {
  return <>
    <PageIntro eyebrow="VCC" title="Über Vexlor Control Center" description="Dein lokales Control Center für Systemübersicht, Spiele und Gaming-Werkzeuge." />
    <section className="about-hero panel"><span className="about-logo"><span className="brand-mark"><span /></span></span><div><div className="section-kicker">VCC · VERSION {packageJson.version}</div><h2>Vexlor Control Center</h2><p>Systeminformationen werden lokal auf diesem PC verarbeitet. Nutzungsstatistiken sind bei neuen Installationen standardmäßig aktiviert und können in den Einstellungen ausgeschaltet werden.</p></div></section>
    <section className="legal-card-grid"><LegalLink title="Impressum" description="Betreiber- und Kontaktangaben." page="Impressum" onNavigate={onNavigate} /><LegalLink title="Datenschutzerklärung" description="Lokale Daten, Systemverarbeitung und Online-Anfragen." page="Datenschutzerklärung" onNavigate={onNavigate} /><LegalLink title="Nutzungsbedingungen" description="Hinweise zur Verwendung und Verfügbarkeit." page="Nutzungsbedingungen" onNavigate={onNavigate} /></section>
    <section className="settings-card panel contact-card"><SettingHeading icon="network" title="Kontakt" description="Für Fragen erreichst du den Betreiber per E-Mail." /><button className="primary-button" onClick={() => void window.vcc.openEmail()}>E-Mail verfassen</button></section>
  </>
}

export function LegalPage({ page }: { page: 'Impressum' | 'Datenschutzerklärung' | 'Nutzungsbedingungen' }) {
  return <>
    <PageIntro eyebrow="RECHTLICHE INFORMATIONEN" title={page} description="Offline verfügbar · Die rechtlichen Angaben vor einer öffentlichen Veröffentlichung fachlich prüfen lassen." />
    <article className="legal-document panel">
      {page === 'Impressum' ? <Imprint /> : page === 'Datenschutzerklärung' ? <PrivacyNotice /> : <TermsNotice />}
    </article>
  </>
}

function Imprint() {
  return <div className="legal-copy">
    <h2>IMPRESSUM</h2>
    <strong>Vexlor Control Center</strong>
    <h3>Betreiber</h3>
    <p>Name: Noah Scheider<br />Projektname: Vexlor Control Center<br />Rechtsform: Privatperson</p>
    <h3>Anschrift</h3>
    <p>Straße und Hausnummer: John-F-Kennedy Straße 10<br />Postleitzahl und Ort: 90761 Kassel<br />Land: Deutschland</p>
    <h3>Kontakt</h3>
    <p>E-Mail: <button className="inline-link" onClick={() => void window.vcc.openEmail()}>kontakt.noah224@gmail.com</button></p>
    <h3>Verantwortlichkeit</h3>
    <p>Verantwortlich für den Inhalt:<br />Noah Scheider.<br />Anschrift per E-Mail.</p>
    <p className="imprint-copyright">© 2026 Vexlor Control Center. Alle Rechte vorbehalten.</p>
  </div>
}

function PrivacyNotice() {
  return <div className="legal-copy">
    <h2>Datenschutzerklärung</h2>
    <p className="legal-updated">Stand: November 2026 · Diese Beschreibung bezieht sich auf den Funktionsumfang von VCC {packageJson.version}.</p>
    <h3>Verantwortlicher und Kontakt</h3><p>Verantwortlich für diese Anwendung ist Noah Scheider, Vexlor Control Center. Datenschutzfragen können per E-Mail an <button className="inline-link" onClick={() => void window.vcc.openEmail()}>kontakt.noah224@gmail.com</button> gerichtet werden.</p>
    <h3>Lokal gespeicherte Daten</h3><p>Spieleinträge (Name, Beschreibung, Kategorie, Pfad zur ausführbaren Datei, optionales Cover, Favoritenstatus und letzter Start), Gaming-Notizen sowie Einstellungen wie Theme, Akzentfarbe, lokales Hintergrundbild, Autostart-Präferenz und Updateprüfung werden als JSON-Datei im Electron-Benutzerordner dieses Windows-Kontos gespeichert. Cover und Hintergrundbilder liegen als Bilddaten in dieser Datei. Die Anwendung benötigt dafür keinen Benutzeraccount.</p>
    <h3>Systeminformationen</h3><p>Zur Anzeige liest die Anwendung lokal Prozessnamen, Prozess-IDs und CPU-/RAM-Nutzung, CPU-Modell und -Auslastung, Arbeitsspeicher, erkannte Grafikadapter, Festplattenkapazitäten, Betriebssystemversion, aktive Netzwerkadapter, Adapterzähler und lokale IPv4-Adressen. Die Messwerte werden im Arbeitsspeicher verarbeitet und nicht in die Datendatei geschrieben. Temperaturwerte werden nicht ausgelesen. Prozesse werden nicht beendet.</p>
    <h3>Externe Dienste, Updates und optionale Nutzungsstatistiken</h3><p>Bei neuen Installationen sind Nutzungsstatistiken standardmäßig aktiviert. Solange die Erfassung aktiviert ist, übermittelt VCC eine zufällige Installationskennung, App-Version, Plattform und Zeitstempel für App-/Sitzungsstarts, Heartbeats und Sitzungsenden an die Vexlor-Website. Daraus werden Nutzungsstatistiken berechnet. Es werden keine Passwörter, Dateien, Systemmesswerte oder Bildschirminhalte übertragen. Die Verbindung wird von Cloudflare verarbeitet; dabei können übliche Verbindungsdaten wie die IP-Adresse anfallen. Du kannst die Erfassung in den Einstellungen jederzeit ausschalten; die App übermittelt dann eine Löschanfrage für die zugehörigen Telemetriedaten. Eine Updateprüfung erfolgt bei manueller Anforderung oder – sofern aktiviert – automatisch beim App-Start und alle 6 Stunden. Dafür fragt VCC die GitHub-Releases-API des öffentlichen Repositorys DarkRanger-wk/Vexlor-Control-Center ab. Ein Installer wird erst nach deinem Klick heruntergeladen. QR-Codes werden lokal generiert.</p>
    <h3>Speicherdauer und deine Möglichkeiten</h3><p>Lokale App-Daten bleiben bis zur Nutzung von „Alle lokalen App-Daten löschen“ oder bis zu einer manuellen Entfernung erhalten. Eine Deinstallation muss den Benutzerdatenordner nicht entfernen. Du kannst Spielpfade und Notizen in der App ändern, Spieleinträge löschen oder alle App-Daten über die Einstellungen zurücksetzen. Die eigentlichen Spiele-Dateien werden dadurch nicht verschoben oder gelöscht. Serverseitige Sitzungsstatistiken bleiben bis zum Widerruf der Telemetrie erhalten; technische Deduplizierungsdaten werden spätestens nach 30 Tagen entfernt.</p>
    <h3>Kontakt</h3><p>Bei Datenschutzfragen: <button className="inline-link" onClick={() => void window.vcc.openEmail()}>kontakt.noah224@gmail.com</button>.</p>
  </div>
}

function TermsNotice() {
  return <div className="legal-copy">
    <h2>Nutzungsbedingungen</h2>
    <p className="legal-updated">Hinweise für die Verwendung von Vexlor Control Center.</p>
    <h3>Zweck und Verwendung</h3><p>VCC ist ein lokales Desktop-Werkzeug für Systemübersichten, Spieleverknüpfungen und einfache Gaming-Hilfsmittel. Du bist dafür verantwortlich, nur Dateien und Programme hinzuzufügen und zu starten, zu deren Nutzung du berechtigt bist.</p>
    <h3>Verantwortungsvolle Nutzung</h3><p>Prüfe ausgewählte ausführbare Dateien vor dem Start. VCC verlangt keine Administratorrechte und beendet keine Prozesse oder ändert keine Windows-Registry-Einstellungen. Vermeide Eingaben oder Aktionen, die die Sicherheit oder Verfügbarkeit deines Geräts beeinträchtigen.</p>
    <h3>Urheberrechte und geistiges Eigentum</h3><p>Rechte an der Anwendung und ihren Bestandteilen verbleiben bei den jeweiligen Rechteinhabern. Für selbst hinzugefügte Spiele, Beschreibungen und Cover bist du selbst verantwortlich; du musst über die erforderlichen Nutzungsrechte verfügen.</p>
    <h3>Verfügbarkeit und Einschränkungen</h3><p>Die Anwendung wird mit dem derzeitigen Funktionsumfang bereitgestellt. Systemdaten hängen von Windows, Hardware und verfügbaren Schnittstellen ab und können fehlen oder abweichen. Temperaturwerte und GPU-Auslastung werden derzeit nicht bereitgestellt. Eine ununterbrochene oder fehlerfreie Verfügbarkeit wird nicht zugesichert.</p>
    <h3>Updates, optionale Telemetrie und Änderungen</h3><p>VCC prüft über den Button oder – wenn aktiviert – beim App-Start und alle 6 Stunden das öffentliche GitHub-Repository DarkRanger-wk/Vexlor-Control-Center. Ein Klick auf „Update installieren“ prüft erneut das neueste Release und installiert den Windows-Installer still im vorhandenen App-Ordner. Gespeicherte Spiele, Einstellungen und Notizen bleiben erhalten. Bei neuen Installationen sind Nutzungsstatistiken standardmäßig aktiviert; du kannst sie in den Einstellungen ausschalten. Gibt es keinen Installer, wird die Release-Seite geöffnet.</p>
    <h3>Online-Funktionen</h3><p>Ohne Internet funktionieren lokale Ansichten, Spieleinträge und Gaming-Werkzeuge. Nur die manuelle Updateprüfung und das Öffnen externer Links benötigen eine Verbindung. Für Inhalte und Verfügbarkeit externer Dienste ist deren jeweiliger Anbieter zuständig.</p>
    <h3>Haftung</h3><p>Diese Hinweise beschränken keine Haftung, soweit eine Beschränkung gesetzlich unzulässig ist. Die Anwendung liefert Informationen ohne Garantie für Vollständigkeit oder Eignung für einen bestimmten Zweck. Bewahre wichtige Daten unabhängig von der Anwendung auf.</p>
    <h3>Änderungen und Kontakt</h3><p>Diese Nutzungsbedingungen können zusammen mit der Anwendung aktualisiert werden. Fragen: <button className="inline-link" onClick={() => void window.vcc.openEmail()}>kontakt.noah224@gmail.com</button>.</p>
  </div>
}

function LegalLink({ title, description, page, onNavigate }: { title: string; description: string; page: string; onNavigate: (page: string) => void }) {
  return <button className="legal-link-card panel" onClick={() => onNavigate(page)}><span className="legal-card-icon"><Icon name="library" /></span><strong>{title}</strong><small>{description}</small><span className="legal-card-open">Öffnen <Icon name="arrow" /></span></button>
}

function SettingHeading({ icon, title, description }: { icon: 'spark' | 'monitor' | 'library' | 'settings' | 'refresh' | 'network'; title: string; description: string }) {
  return <div className="setting-heading"><span><Icon name={icon} /></span><div><h2>{title}</h2><p>{description}</p></div></div>
}

function SettingSwitch({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="switch-row"><span><strong>{title}</strong><small>{description}</small></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>
}
