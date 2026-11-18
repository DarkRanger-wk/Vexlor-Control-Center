import type { CustomizationSettings, CustomizationTheme, CustomizationValues } from '../types/app'

export const themePresets: CustomizationTheme[]
export function createDefaultCustomization(): CustomizationSettings
export function isHexColor(value: unknown): value is string
export function hexToRgb(value: string): { r: number; g: number; b: number } | null
export function rgbToHex(red: number, green: number, blue: number): string
export function rgbToHsl(red: number, green: number, blue: number): { h: number; s: number; l: number }
export function applyThemeToValues(currentValues: CustomizationValues, theme: CustomizationTheme): CustomizationValues
export function isThemeImport(value: unknown): value is { name: string; values: CustomizationValues }
export function makeId(prefix: string): string
