// CONSTANTS
export const THEME_MODES = Object.freeze([
  "light",
  "dark",
  "auto"
] as const);
export const DENSITIES = Object.freeze([
  "compact",
  "default",
  "comfortable"
] as const);

export type ThemeMode = typeof THEME_MODES[number];
export type Density = typeof DENSITIES[number];
