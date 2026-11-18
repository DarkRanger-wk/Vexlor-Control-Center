import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyThemeToValues,
  createDefaultCustomization,
  hexToRgb,
  isHexColor,
  isThemeImport,
  rgbToHex,
  rgbToHsl,
  themePresets,
} from './customization.mjs'

test('provides all eight named themes and a durable default profile', () => {
  assert.deepEqual(themePresets.map((theme) => theme.name), [
    'Midnight Blue', 'Cyber Purple', 'Neon Green', 'Crimson Red',
    'Arctic Cyan', 'Golden Black', 'Rose Pink', 'Pure White',
  ])
  const customization = createDefaultCustomization()
  assert.equal(customization.activeProfileId, 'default')
  assert.equal(customization.profiles[0].values.themeId, 'midnight-blue')
})

test('converts HEX, RGB, and HSL values including grayscale edges', () => {
  assert.deepEqual(hexToRgb('#428BFF'), { r: 66, g: 139, b: 255 })
  assert.equal(isHexColor('#428BFF'), true)
  assert.equal(isHexColor('#xyz'), false)
  assert.equal(rgbToHex(66, 139, 255), '#428BFF')
  assert.deepEqual(rgbToHsl(255, 255, 255), { h: 0, s: 0, l: 100 })
  assert.deepEqual(rgbToHsl(0, 0, 0), { h: 0, s: 0, l: 0 })
})

test('applying a theme copies colors, background, and layout without sharing references', () => {
  const defaults = createDefaultCustomization()
  const theme = themePresets[1]
  const applied = applyThemeToValues(defaults.values, theme)

  assert.equal(applied.themeId, theme.id)
  assert.equal(applied.colors.accent, theme.values.colors.accent)
  assert.notEqual(applied.colors, theme.values.colors)
  assert.notEqual(applied.layout.sidebarIcons, theme.values.layout.sidebarIcons)
  assert.equal(defaults.values.themeId, 'midnight-blue')
})

test('accepts a theme import only when its required colors are valid HEX values', () => {
  const theme = themePresets[0]
  assert.equal(isThemeImport({ name: 'Imported', values: theme.values }), true)
  assert.equal(isThemeImport({ name: 'Invalid', values: { colors: { ...theme.values.colors, accent: 'blue' } } }), false)
})
