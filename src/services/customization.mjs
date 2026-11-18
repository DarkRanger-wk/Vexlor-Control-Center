const defaultLayout = {
  sidebarWidth: 248,
  compactSidebar: false,
  fontSize: 10,
  fontFamily: 'DM Sans',
  radius: 11,
  transparency: 8,
  shadows: true,
  glow: false,
  animations: true,
  animationSpeed: 1,
  sidebarIcons: {},
}

function makeTheme(id, name, colors) {
  return {
    id,
    name,
    values: {
      themeId: id,
      colors,
      background: {
        mode: 'solid',
        gradientStart: colors.background,
        gradientEnd: colors.card,
        imageData: null,
        blur: 0,
        opacity: 100,
      },
      layout: { ...defaultLayout, sidebarIcons: {} },
    },
  }
}

export const themePresets = [
  makeTheme('midnight-blue', 'Midnight Blue', {
    accent: '#428BFF', background: '#080D18', sidebar: '#0A101D', card: '#0D1523',
    menu: '#101B2C', button: '#1A467A', border: '#25415F', text: '#E8EDF7', muted: '#8393AA',
  }),
  makeTheme('cyber-purple', 'Cyber Purple', {
    accent: '#B56BFF', background: '#100B1A', sidebar: '#160E24', card: '#1B122B',
    menu: '#251638', button: '#6531A0', border: '#49306A', text: '#F2E9FF', muted: '#AD9CC2',
  }),
  makeTheme('neon-green', 'Neon Green', {
    accent: '#5CEB5C', background: '#07130B', sidebar: '#0B1A10', card: '#0D2015',
    menu: '#12291B', button: '#1A693A', border: '#28563A', text: '#E9FFEE', muted: '#9FB8A6',
  }),
  makeTheme('crimson-red', 'Crimson Red', {
    accent: '#FF5364', background: '#16090C', sidebar: '#1D0D12', card: '#241117',
    menu: '#2C151C', button: '#8D2E3E', border: '#63313A', text: '#FFE9EC', muted: '#B9A1A5',
  }),
  makeTheme('arctic-cyan', 'Arctic Cyan', {
    accent: '#42D8F4', background: '#07131A', sidebar: '#0B1B24', card: '#0E222D',
    menu: '#142D39', button: '#1F6476', border: '#2A5968', text: '#E6FAFF', muted: '#98BAC3',
  }),
  makeTheme('golden-black', 'Golden Black', {
    accent: '#F0C15A', background: '#12110D', sidebar: '#19170F', card: '#211E13',
    menu: '#292516', button: '#846327', border: '#5C4C2B', text: '#FFF6D8', muted: '#BEB18D',
  }),
  makeTheme('rose-pink', 'Rose Pink', {
    accent: '#FF70B7', background: '#190D16', sidebar: '#21111D', card: '#2A1624',
    menu: '#341A2C', button: '#8B3E6A', border: '#633652', text: '#FFF0F7', muted: '#C6A7B8',
  }),
  makeTheme('pure-white', 'Pure White', {
    accent: '#386FCE', background: '#F2F5FB', sidebar: '#E3EAF5', card: '#FFFFFF',
    menu: '#F5F7FC', button: '#4C7DD0', border: '#CBD5E1', text: '#152033', muted: '#56647A',
  }),
]

function copy(value) {
  return JSON.parse(JSON.stringify(value))
}

export function createDefaultCustomization() {
  const preset = copy(themePresets[0].values)
  return {
    activeProfileId: 'default',
    values: preset,
    profiles: [{ id: 'default', name: 'Standard', values: copy(preset) }],
    themes: [],
    palettes: [],
  }
}

export function isHexColor(value) {
  return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)
}

export function hexToRgb(value) {
  if (!isHexColor(value)) return null
  const hex = value.slice(1)
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  }
}

export function rgbToHex(red, green, blue) {
  return `#${[red, green, blue]
    .map((channel) => Math.round(Math.max(0, Math.min(255, channel))).toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase()
}

export function rgbToHsl(red, green, blue) {
  const r = red / 255
  const g = green / 255
  const b = blue / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  let hue = 0
  let saturation = 0
  const lightness = (max + min) / 2

  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1))
    switch (max) {
      case r: hue = ((g - b) / delta) % 6; break
      case g: hue = (b - r) / delta + 2; break
      default: hue = (r - g) / delta + 4
    }
    hue *= 60
    if (hue < 0) hue += 360
  }

  return {
    h: Math.round(hue),
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100),
  }
}

export function applyThemeToValues(currentValues, theme) {
  return {
    ...currentValues,
    themeId: theme.id,
    colors: { ...theme.values.colors },
    background: { ...theme.values.background },
    layout: { ...theme.values.layout, sidebarIcons: { ...theme.values.layout.sidebarIcons } },
  }
}

export function isThemeImport(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || typeof value.name !== 'string'
    || !value.name.trim()
    || !value.values
    || typeof value.values !== 'object'
    || Array.isArray(value.values)) {
    return false
  }
  const colors = value.values.colors
  if (!colors || typeof colors !== 'object' || Array.isArray(colors)
    || !['accent', 'background', 'sidebar', 'card', 'menu', 'button', 'border', 'text', 'muted']
      .every((key) => isHexColor(colors[key]))) return false

  const background = value.values.background
  const layout = value.values.layout
  if (!background || typeof background !== 'object' || Array.isArray(background)
    || !['solid', 'gradient', 'image'].includes(background.mode)
    || !isHexColor(background.gradientStart)
    || !isHexColor(background.gradientEnd)
    || (background.imageData !== null && (typeof background.imageData !== 'string'
      || !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(background.imageData)))
    || typeof background.blur !== 'number' || background.blur < 0 || background.blur > 24
    || typeof background.opacity !== 'number' || background.opacity < 0 || background.opacity > 100
    || !layout || typeof layout !== 'object' || Array.isArray(layout)) return false

  const numericRanges = [
    ['sidebarWidth', 180, 340], ['fontSize', 9, 16], ['radius', 0, 24],
    ['transparency', 0, 30], ['animationSpeed', 0.5, 2],
  ]
  if (numericRanges.some(([key, min, max]) => typeof layout[key] !== 'number'
    || !Number.isFinite(layout[key]) || layout[key] < min || layout[key] > max)) return false
  if (!['compactSidebar', 'shadows', 'glow', 'animations'].every((key) => typeof layout[key] === 'boolean')
    || !['DM Sans', 'Segoe UI', 'Arial', 'Verdana', 'Consolas'].includes(layout.fontFamily)
    || !layout.sidebarIcons
    || typeof layout.sidebarIcons !== 'object'
    || Array.isArray(layout.sidebarIcons)) return false
  const allowedIcons = new Set(['dashboard', 'monitor', 'library', 'performance', 'network', 'tools', 'arcade', 'target', 'clock', 'crown', 'bolt', 'launch', 'screenshot', 'copy', 'save', 'zoomIn', 'zoomOut', 'settings', 'refresh', 'cpu', 'memory', 'windows', 'spark', 'arrow'])
  const allowedLabels = new Set(['Dashboard', 'System Monitor', 'Spielebibliothek', 'Performance', 'Network Center', 'Gaming Tools', 'Vexlor Arcade', 'Screenshot Tool', 'Customization', 'Einstellungen', 'Über Vexlor'])
  return Object.entries(layout.sidebarIcons).every(([label, icon]) => allowedLabels.has(label) && allowedIcons.has(icon))
}

export function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
