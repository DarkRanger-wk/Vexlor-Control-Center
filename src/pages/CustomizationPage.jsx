import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { applyThemeToValues, createDefaultCustomization, hexToRgb, isHexColor, isThemeImport, makeId, rgbToHsl, themePresets } from '../services/customization.mjs'
import './customization.css'

const colorLabels = [
  ['accent', 'Akzentfarbe'],
  ['background', 'Hintergrund'],
  ['sidebar', 'Sidebar'],
  ['card', 'Karten'],
  ['menu', 'Menüs'],
  ['button', 'Buttons'],
  ['border', 'Rahmen'],
  ['text', 'Text'],
  ['muted', 'Sekundärtext'],
]

const navigationLabels = [
  'Dashboard', 'System Monitor', 'Spielebibliothek', 'Performance', 'Network Center',
  'Gaming Tools', 'Vexlor Arcade', 'Screenshot Tool', 'Customization', 'Einstellungen', 'Über Vexlor',
]
const iconNames = [
  'dashboard', 'monitor', 'library', 'performance', 'network', 'tools', 'arcade', 'target',
  'clock', 'crown', 'bolt', 'launch', 'screenshot', 'copy', 'save', 'zoomIn', 'zoomOut',
  'settings', 'refresh', 'cpu', 'memory', 'windows', 'spark', 'arrow',
]
const tabs = [
  ['Farben', 'spark'],
  ['Themes', 'monitor'],
  ['Oberfläche', 'settings'],
  ['Hintergrund', 'library'],
  ['Profile', 'windows'],
]

export default function CustomizationPage({ settings, updateSettings, notifyError, notifyInfo }) {
  const [activeTab, setActiveTab] = useState('Farben')
  const importInput = useRef(null)
  const customization = settings.customization ?? createDefaultCustomization()
  const values = customization.values
  const rgbValues = useMemo(() => Object.fromEntries(colorLabels.map(([key]) => {
    const rgb = hexToRgb(values.colors[key])
    return [key, rgb ? { ...rgb, hsl: rgbToHsl(rgb.r, rgb.g, rgb.b) } : null]
  })), [values.colors])

  const save = (nextCustomization) => void updateSettings({
    customization: nextCustomization,
    accent: nextCustomization.values.colors.accent,
    animations: nextCustomization.values.layout.animations,
    compactSidebar: nextCustomization.values.layout.compactSidebar,
    backgroundData: nextCustomization.values.background.mode === 'image'
      ? nextCustomization.values.background.imageData
      : null,
  })

  const updateValues = (change) => {
    const nextValues = typeof change === 'function' ? change(values) : { ...values, ...change }
    const profiles = customization.profiles.map((profile) => profile.id === customization.activeProfileId
      ? { ...profile, values: nextValues }
      : profile)
    save({ ...customization, values: nextValues, profiles })
  }

  const updateColor = (key, color) => {
    if (!isHexColor(color)) return
    updateValues({ ...values, colors: { ...values.colors, [key]: color.toUpperCase() } })
  }

  const applyTheme = (theme) => {
    updateValues(applyThemeToValues(values, theme))
    notifyInfo(`Theme „${theme.name}“ wurde angewendet.`)
  }

  const restoreDefaults = () => {
    const defaults = createDefaultCustomization()
    const defaultValues = defaults.values
    const profiles = customization.profiles.map((profile) => profile.id === customization.activeProfileId
      ? { ...profile, values: defaultValues }
      : profile)
    save({ ...customization, values: defaultValues, profiles })
    notifyInfo('Das Standard-Theme wurde wiederhergestellt.')
  }

  const saveCurrentTheme = () => {
    if (customization.themes.length >= 24) {
      notifyError('Es können höchstens 24 eigene Themes gespeichert werden.')
      return
    }
    const name = window.prompt('Name des Themes:', 'Mein Theme')
    if (!name?.trim()) return
    const id = makeId('theme')
    const themeValues = { ...structuredClone(values), themeId: id }
    const theme = { id, name: name.trim().slice(0, 40), values: themeValues }
    const profiles = customization.profiles.map((profile) => profile.id === customization.activeProfileId
      ? { ...profile, values: themeValues }
      : profile)
    save({ ...customization, values: themeValues, profiles, themes: [...customization.themes, theme] })
    notifyInfo(`Theme „${theme.name}“ wurde gespeichert.`)
  }

  const overwriteTheme = (theme) => {
    const themeValues = { ...structuredClone(values), themeId: theme.id }
    save({
      ...customization,
      themes: customization.themes.map((saved) => saved.id === theme.id
        ? { ...saved, values: themeValues }
        : saved),
    })
    notifyInfo(`„${theme.name}“ wurde mit den aktuellen Einstellungen aktualisiert.`)
  }

  const renameTheme = (theme) => {
    const name = window.prompt('Neuer Theme-Name:', theme.name)
    if (!name?.trim()) return
    save({ ...customization, themes: customization.themes.map((saved) => saved.id === theme.id ? { ...saved, name: name.trim().slice(0, 40) } : saved) })
  }

  const deleteTheme = (theme) => {
    if (!window.confirm(`Theme „${theme.name}“ löschen?`)) return
    save({ ...customization, themes: customization.themes.filter((saved) => saved.id !== theme.id) })
  }

  const exportTheme = (theme) => {
    const blob = new Blob([JSON.stringify({ version: 1, name: theme.name, values: theme.values }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${theme.name.toLowerCase().replace(/[^a-z0-9-]+/g, '-')}.vexlor-theme.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const importTheme = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error('Die Theme-Datei ist größer als 8 MB.')
      const imported = JSON.parse(await file.text())
      if (!isThemeImport(imported)) throw new Error('Die Datei enthält kein gültiges Vexlor-Theme.')
      const importedValues = {
        ...values,
        ...imported.values,
        themeId: makeId('imported'),
        colors: { ...values.colors, ...imported.values.colors },
        background: { ...values.background, ...(imported.values.background ?? {}) },
        layout: { ...values.layout, ...(imported.values.layout ?? {}) },
      }
      const id = makeId('theme')
      const theme = { id, name: imported.name.trim().slice(0, 40), values: { ...importedValues, themeId: id } }
      if (customization.themes.length >= 24) throw new Error('Es können höchstens 24 eigene Themes gespeichert werden.')
      const appliedValues = applyThemeToValues(values, theme)
      const profiles = customization.profiles.map((profile) => profile.id === customization.activeProfileId
        ? { ...profile, values: appliedValues }
        : profile)
      save({ ...customization, themes: [...customization.themes, theme], values: appliedValues, profiles })
      notifyInfo(`Theme „${theme.name}“ wurde importiert.`)
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Theme konnte nicht importiert werden.')
    }
  }

  const savePalette = () => {
    if (customization.palettes.length >= 24) {
      notifyError('Es können höchstens 24 Farbpaletten gespeichert werden.')
      return
    }
    const name = window.prompt('Name der Farbpalette:', 'Meine Palette')
    if (!name?.trim()) return
    const palette = { id: makeId('palette'), name: name.trim().slice(0, 40), colors: { ...values.colors } }
    save({ ...customization, palettes: [...customization.palettes, palette] })
  }

  const saveProfile = () => {
    if (customization.profiles.length >= 16) {
      notifyError('Es können höchstens 16 Designprofile gespeichert werden.')
      return
    }
    const name = window.prompt('Name des Designprofils:', 'Mein Profil')
    if (!name?.trim()) return
    const profile = { id: makeId('profile'), name: name.trim().slice(0, 40), values: structuredClone(values) }
    save({ ...customization, activeProfileId: profile.id, profiles: [...customization.profiles, profile] })
  }

  const applyProfile = (profile) => save({ ...customization, activeProfileId: profile.id, values: structuredClone(profile.values) })

  const renameProfile = (profile) => {
    const name = window.prompt('Neuer Profilname:', profile.name)
    if (!name?.trim()) return
    save({ ...customization, profiles: customization.profiles.map((saved) => saved.id === profile.id ? { ...saved, name: name.trim().slice(0, 40) } : saved) })
  }

  const deleteProfile = (profile) => {
    if (customization.profiles.length < 2) {
      notifyError('Das letzte Designprofil kann nicht gelöscht werden.')
      return
    }
    if (!window.confirm(`Profil „${profile.name}“ löschen?`)) return
    const profiles = customization.profiles.filter((saved) => saved.id !== profile.id)
    const next = profile.id === customization.activeProfileId ? profiles[0] : null
    save({
      ...customization,
      profiles,
      activeProfileId: next?.id ?? customization.activeProfileId,
      values: next ? structuredClone(next.values) : values,
    })
  }

  const saveCurrentProfile = () => {
    const current = customization.profiles.find((profile) => profile.id === customization.activeProfileId)
    if (!current) return
    save({ ...customization, profiles: customization.profiles.map((profile) => profile.id === current.id ? { ...profile, values: structuredClone(values) } : profile) })
    notifyInfo(`Profil „${current.name}“ wurde aktualisiert.`)
  }

  const chooseBackground = async () => {
    try {
      const imageData = await window.vcc.chooseBackground()
      if (imageData) updateValues({ ...values, background: { ...values.background, mode: 'image', imageData } })
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Hintergrundbild konnte nicht geladen werden.')
    }
  }

  const setLayout = (key, value) => updateValues({ ...values, layout: { ...values.layout, [key]: value } })
  const setBackground = (key, value) => updateValues({ ...values, background: { ...values.background, [key]: value } })

  return (
    <div className="customization-page">
      <header className="customization-intro">
        <div><span className="customization-eyebrow">DEIN DESIGN · LIVE ANGEPASST</span><h1>Customization</h1><p>Gestalte Farben, Oberfläche und Hintergrund. Alle Änderungen werden lokal gespeichert.</p></div>
        <button className="customization-reset" onClick={restoreDefaults}>Standard-Theme wiederherstellen</button>
      </header>

      <nav className="customization-tabs" aria-label="Customization-Bereiche">
        {tabs.map(([label, icon]) => <button key={label} className={activeTab === label ? 'active' : ''} onClick={() => setActiveTab(label)}><Icon name={icon} />{label}</button>)}
      </nav>

      <div className="customization-layout">
        <section className="customization-editor">
          {activeTab === 'Farben' && <section className="customization-card">
            <CardHeading title="Farbgestaltung" description="Passe einzelne Farben an. RGB- und HSL-Werte werden live berechnet." />
            <div className="customization-color-grid">
              {colorLabels.map(([key, label]) => {
                const color = values.colors[key]
                const channels = rgbValues[key]
                return <div className="customization-color" key={key}>
                  <label htmlFor={`color-${key}`}>{label}</label>
                  <input id={`color-${key}`} type="color" value={color} onChange={(event) => updateColor(key, event.target.value)} />
                  <HexColorInput label={label} value={color} onChange={(next) => updateColor(key, next)} />
                  {channels && <small>RGB {channels.r}, {channels.g}, {channels.b} · HSL {channels.hsl.h}°, {channels.hsl.s}%, {channels.hsl.l}%</small>}
                </div>
              })}
            </div>
            <div className="customization-actions"><button onClick={savePalette}>Farbpalette speichern</button></div>
            {customization.palettes.length > 0 && <div className="customization-saved-colors">
              {customization.palettes.map((palette) => <div key={palette.id} className="customization-swatch-row"><button className="customization-palette-apply" onClick={() => updateValues({ ...values, colors: { ...palette.colors } })}><span className="customization-swatches">{Object.values(palette.colors).slice(0, 6).map((color, index) => <i key={index} style={{ background: color }} />)}</span>{palette.name}</button><button className="customization-icon-button" aria-label={`${palette.name} löschen`} onClick={() => save({ ...customization, palettes: customization.palettes.filter((item) => item.id !== palette.id) })}>×</button></div>)}
            </div>}
          </section>}

          {activeTab === 'Themes' && <section className="customization-card">
            <CardHeading title="Themes" description="Wähle ein Preset, speichere eigene Themes oder importiere und exportiere sie." />
            <div className="customization-theme-grid">{themePresets.map((theme) => <ThemeTile key={theme.id} theme={theme} selected={values.themeId === theme.id} onSelect={() => applyTheme(theme)} />)}</div>
            <div className="customization-actions">
              <button onClick={saveCurrentTheme}>Aktuelles Theme speichern</button>
              <button onClick={() => importInput.current?.click()}>Theme importieren</button>
              <input ref={importInput} type="file" accept=".json,.vexlor-theme.json,application/json" hidden onChange={(event) => void importTheme(event)} />
            </div>
            {customization.themes.length > 0 && <div className="customization-saved-list">
              <h3>Eigene Themes</h3>
              {customization.themes.map((theme) => <div className="customization-saved-row" key={theme.id}>
                <ThemeTile theme={theme} selected={values.themeId === theme.id} onSelect={() => applyTheme(theme)} compact />
                <button title="Aktuelle Werte in Theme übernehmen" onClick={() => overwriteTheme(theme)}>Aktualisieren</button>
                <button title="Theme umbenennen" onClick={() => renameTheme(theme)}>Name</button>
                <button title="Theme exportieren" onClick={() => exportTheme(theme)}>Export</button>
                <button className="danger" title="Theme löschen" onClick={() => deleteTheme(theme)}>Löschen</button>
              </div>)}
            </div>}
          </section>}

          {activeTab === 'Oberfläche' && <section className="customization-card">
            <CardHeading title="Oberfläche" description="Passe Navigation, Typografie, Ecken und Effekte an." />
            <RangeSetting label="Sidebar-Breite" value={values.layout.sidebarWidth} min={180} max={340} suffix="px" onChange={(value) => setLayout('sidebarWidth', value)} />
            <RangeSetting label="Schriftgröße" value={values.layout.fontSize} min={9} max={16} suffix="px" onChange={(value) => setLayout('fontSize', value)} />
            <label className="customization-select-row"><span>Schriftart</span><select value={values.layout.fontFamily} onChange={(event) => setLayout('fontFamily', event.target.value)}>{['DM Sans', 'Segoe UI', 'Arial', 'Verdana', 'Consolas'].map((font) => <option key={font}>{font}</option>)}</select></label>
            <RangeSetting label="Eckenradius" value={values.layout.radius} min={0} max={24} suffix="px" onChange={(value) => setLayout('radius', value)} />
            <RangeSetting label="Transparenz" value={values.layout.transparency} min={0} max={30} suffix="%" onChange={(value) => setLayout('transparency', value)} />
            <RangeSetting label="Animationsgeschwindigkeit" value={values.layout.animationSpeed} min={0.5} max={2} step={0.1} suffix="×" onChange={(value) => setLayout('animationSpeed', value)} />
            <div className="customization-switch-grid">
              <SwitchSetting label="Kompakte Sidebar" checked={values.layout.compactSidebar} onChange={(value) => setLayout('compactSidebar', value)} />
              <SwitchSetting label="Schatten" checked={values.layout.shadows} onChange={(value) => setLayout('shadows', value)} />
              <SwitchSetting label="Glow-Effekte" checked={values.layout.glow} onChange={(value) => setLayout('glow', value)} />
              <SwitchSetting label="Animationen" checked={values.layout.animations} onChange={(value) => setLayout('animations', value)} />
            </div>
            <h3 className="customization-subheading">Sidebar-Symbole</h3>
            <div className="customization-icon-grid">{navigationLabels.map((label) => <label key={label}>{label}<select value={values.layout.sidebarIcons[label] ?? ''} onChange={(event) => {
              const sidebarIcons = { ...values.layout.sidebarIcons }
              if (event.target.value) sidebarIcons[label] = event.target.value
              else delete sidebarIcons[label]
              setLayout('sidebarIcons', sidebarIcons)
            }}><option value="">Standard</option>{iconNames.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>)}</div>
          </section>}

          {activeTab === 'Hintergrund' && <section className="customization-card">
            <CardHeading title="Hintergrund" description="Nutze eine Volltonfarbe, einen Verlauf oder ein lokales Bild." />
            <div className="customization-mode-row">{[['solid', 'Einfarbig'], ['gradient', 'Verlauf'], ['image', 'Bild']].map(([mode, label]) => <button key={mode} className={values.background.mode === mode ? 'active' : ''} onClick={() => setBackground('mode', mode)}>{label}</button>)}</div>
            {values.background.mode === 'solid' && <ColorSetting label="Hintergrundfarbe" value={values.colors.background} onChange={(color) => updateColor('background', color)} />}
            {values.background.mode === 'gradient' && <div className="customization-color-grid two">{[['gradientStart', 'Verlaufsstart'], ['gradientEnd', 'Verlaufsende']].map(([key, label]) => <ColorSetting key={key} label={label} value={values.background[key]} onChange={(color) => setBackground(key, color)} />)}</div>}
            {values.background.mode === 'image' && <div className="customization-background-image">
              <div className="customization-image-preview" style={values.background.imageData ? { backgroundImage: `url("${values.background.imageData}")` } : undefined}>{values.background.imageData ? 'Lokales Hintergrundbild' : 'Kein Bild ausgewählt'}</div>
              <button onClick={() => void chooseBackground()}>Bild auswählen</button>
              {values.background.imageData && <button className="danger" onClick={() => setBackground('imageData', null)}>Bild entfernen</button>}
              <small>Bilder bleiben lokal auf diesem PC und dürfen höchstens 5 MB groß sein.</small>
            </div>}
            <RangeSetting label="Hintergrundunschärfe" value={values.background.blur} min={0} max={24} suffix="px" onChange={(value) => setBackground('blur', value)} />
            <RangeSetting label="Deckkraft" value={values.background.opacity} min={20} max={100} suffix="%" onChange={(value) => setBackground('opacity', value)} />
          </section>}

          {activeTab === 'Profile' && <section className="customization-card">
            <CardHeading title="Designprofile" description="Speichere mehrere vollständige Designkonfigurationen und wechsle zwischen ihnen." />
            <div className="customization-actions">
              <button onClick={saveProfile}>Profil aus aktueller Ansicht erstellen</button>
              <button className="secondary" onClick={saveCurrentProfile}>Aktuelles Profil aktualisieren</button>
            </div>
            <div className="customization-profile-list">{customization.profiles.map((profile) => <div className={`customization-profile${profile.id === customization.activeProfileId ? ' active' : ''}`} key={profile.id}>
              <button className="customization-profile-select" onClick={() => applyProfile(profile)}><strong>{profile.name}</strong><small>{profile.id === customization.activeProfileId ? 'Aktives Profil' : profile.values.themeId}</small></button>
              <button className="customization-icon-button" title="Umbenennen" onClick={() => renameProfile(profile)}>Name</button>
              <button className="customization-icon-button danger" title="Profil löschen" onClick={() => deleteProfile(profile)}>Löschen</button>
            </div>)}</div>
          </section>}
        </section>

        <aside className="customization-preview">
          <div className="customization-card">
            <CardHeading title="Live-Vorschau" description="Änderungen erscheinen direkt in der Anwendung." />
            <div className="customization-preview-window" style={{
              '--preview-bg': values.colors.background,
              '--preview-sidebar': values.colors.sidebar,
              '--preview-card': values.colors.card,
              '--preview-menu': values.colors.menu,
              '--preview-button': values.colors.button,
              '--preview-accent': values.colors.accent,
              '--preview-border': values.colors.border,
              '--preview-text': values.colors.text,
              '--preview-muted': values.colors.muted,
              '--preview-radius': `${values.layout.radius}px`,
            }}>
              <div className="customization-preview-sidebar"><strong>VEXLOR</strong><span>Dashboard</span><span className="selected">Customization</span><span>Vexlor Arcade</span></div>
              <div className="customization-preview-main">
                <span className="customization-preview-menu">MENU</span>
                <h2>Übersicht</h2>
                <div className="customization-preview-card"><small>KARTE</small><strong>Dein Dashboard</strong><span>Live angepasste Oberfläche</span></div>
                <button>Akzent-Button</button>
              </div>
            </div>
            <div className="customization-preview-legend"><span>Sidebar</span><span>Buttons</span><span>Karten</span><span>Menüs</span></div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function CardHeading({ title, description }) {
  return <div className="customization-card-heading"><h2>{title}</h2><p>{description}</p></div>
}

function ThemeTile({ theme, selected, onSelect, compact = false }) {
  const colors = theme.values.colors
  return <button className={`customization-theme-tile${selected ? ' selected' : ''}${compact ? ' compact' : ''}`} onClick={onSelect}>
    <span className="customization-theme-colors" style={{ background: colors.background }}><i style={{ background: colors.sidebar }} /><i style={{ background: colors.card }} /><i style={{ background: colors.accent }} /></span>
    <span><strong>{theme.name}</strong>{!compact && <small>{colors.accent} · {colors.background}</small>}</span>
    {selected && <span className="customization-theme-check">✓</span>}
  </button>
}

function ColorSetting({ label, value, onChange }) {
  return <label className="customization-color-setting"><span>{label}</span><input type="color" value={value} onChange={(event) => onChange(event.target.value)} /><code>{value}</code></label>
}

function HexColorInput({ label, value, onChange }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  return <input
    aria-label={`${label} als HEX`}
    className="customization-hex"
    value={draft}
    maxLength={7}
    spellCheck={false}
    onChange={(event) => {
      const next = event.target.value.startsWith('#') ? event.target.value : `#${event.target.value}`
      setDraft(next)
      if (isHexColor(next)) onChange(next)
    }}
    onBlur={() => { if (!isHexColor(draft)) setDraft(value) }}
  />
}

function RangeSetting({ label, value, min, max, step = 1, suffix, onChange }) {
  return <label className="customization-range"><span>{label}<strong>{value}{suffix}</strong></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>
}

function SwitchSetting({ label, checked, onChange }) {
  return <label className="customization-switch"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>
}
