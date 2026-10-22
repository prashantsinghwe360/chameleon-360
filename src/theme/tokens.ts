/* =====================================================================
 * WE360 DESIGN TOKENS - single source of truth (We360 Design System).
 * Every colour in the dashboard comes from here. styles.css mirrors the
 * same values as CSS variables for non-chart UI.
 * ===================================================================== */

/** 1 · Brand */
export const brand = {
  deepIndigo: '#0E082E',   // left nav bar
  primary: '#7B61FF',      // buttons, active/selected, focus
  primaryHover: '#6A4FF0',
  primaryTint: '#E5DFFF',  // soft brand bg
} as const;

/** 2 · Colour families - each is { dark: text, base: mark/series, light: surface } */
export interface Triad { dark: string; base: string; light: string }
export const family = {
  magenta: { dark: '#651972', base: '#9C27B0', light: '#CD93D7' },
  lavender: { dark: '#51269A', base: '#7C3AED', light: '#BD9CF6' },
  cyan: { dark: '#0B76B7', base: '#18BFFF', light: '#D0F0FD' },
  blue: { dark: '#2F4F9B', base: '#487AEF', light: '#A3BCF7' },
  green: { dark: '#16803C', base: '#22C55D', light: '#BDEECE' },
  tealGreen: { dark: '#0E786C', base: '#15B8A6', light: '#8ADBD3' },
  yellow: { dark: '#A68B00', base: '#FFD600', light: '#FFEB80' },
  amber: { dark: '#9F6708', base: '#F59E0C', light: '#FACF85' },
  orange: { dark: '#A24B0E', base: '#F97315', light: '#FDD5B9' },
  brinkRed: { dark: '#A6394D', base: '#FF5777', light: '#FFABBB' },
  coralRed: { dark: '#9B2C2C', base: '#EF4444', light: '#FAC7C7' },
} as const satisfies Record<string, Triad>;

/** 3 · Neutrals - slate ramp */
export const slate = {
  900: '#191127', // titles
  700: '#344054', // body
  500: '#667085', // muted
  400: '#94A4B8', // faint
  200: '#C9D1DB', // idle / disabled
  100: '#E2DFEF', // borders
  50: '#EFF1F5',  // canvas
  white: '#FFFFFF',
} as const;

/** 4 · Signals - system feedback only, never a data series */
export const signal = {
  success: { light: '#BDEECE', base: '#22C55D', dark: '#16803C' },
  warning: { light: '#FDD5B9', base: '#F97315', dark: '#A24B0E' },
  error: { light: '#FFABBB', base: '#FF5777', dark: '#A6394D' },
  info: { light: '#D0F0FD', base: '#18BFFF', dark: '#0B76B7' },
} as const;

/** 7 · Data · Analytics - Base tone is the series colour */
export const analytics = {
  working: family.lavender.base,
  online: family.lavender.light,
  active: family.blue.base,
  idle: slate[200],
  productive: family.green.base,
  unproductive: family.brinkRed.base,
  neutral: slate[400],
  manual: family.orange.base,
} as const;

/** 8 · Data · Wellness - only three states */
export const wellness = {
  healthy: family.tealGreen.base,
  overburdened: family.amber.base,
  underutilised: family.coralRed.base,
} as const;

/** Ordered series palette for categorical charts (cohorts, categories). */
export const seriesPalette = [
  family.lavender.base, family.cyan.base, family.tealGreen.base, family.amber.base,
  family.magenta.base, family.blue.base, family.orange.base, family.brinkRed.base,
];

/** Warm palette for non-work categories, in config order (one family each, distinct hues). */
export const warmPalette = [
  family.orange.base,   // Social media
  family.amber.base,    // Video / streaming
  family.brinkRed.base, // Gaming
  family.coralRed.dark, // Gambling
  family.magenta.base,  // Adult
  family.yellow.dark,
  family.coralRed.base,
];

/** Typography - Lato throughout; weight carries hierarchy. */
export const type = {
  family: "'Lato', system-ui, -apple-system, 'Segoe UI', sans-serif",
  display: { size: 24, weight: 900 },
  h1: { size: 20, weight: 700 },
  h2: { size: 18, weight: 700 },
  body: { size: 14, weight: 400 },
  small: { size: 12, weight: 400 },
  caption: { size: 11, weight: 700 },
} as const;

/** Spacing (4/8 based), radius, elevation */
export const space = [2, 4, 8, 12, 16, 24] as const;
export const radius = { xs: 2, control: 5, container: 8 } as const;
