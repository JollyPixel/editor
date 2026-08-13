// Import Internal Dependencies
import type {
  Density,
  ThemeMode
} from "./types.ts";

export function resolveThemePreference(
  value: string | null,
  fallback: ThemeMode
): ThemeMode {
  return isThemeMode(value) ? value : fallback;
}

export function resolveDensityPreference(
  value: string | null,
  fallback: Density
): Density {
  return isDensity(value) ? value : fallback;
}

export function applyAppearance(
  target: HTMLElement,
  theme: ThemeMode,
  density: Density
): void {
  if (theme === "auto") {
    target.removeAttribute("theme");
  }
  else {
    target.setAttribute("theme", theme);
  }
  target.setAttribute("density", density);
}

function isThemeMode(
  value: string | null
): value is ThemeMode {
  return value === "light" || value === "dark" || value === "auto";
}

function isDensity(
  value: string | null
): value is Density {
  return value === "compact" || value === "default" || value === "comfortable";
}
