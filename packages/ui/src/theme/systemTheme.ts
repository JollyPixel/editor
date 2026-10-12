// Import Internal Dependencies
import type { ResolvedThemeMode } from "./ambientTheme.ts";

// CONSTANTS
export const PREFERS_DARK_QUERY = "(prefers-color-scheme: dark)";

export function systemThemeMode(
  view: Window | null
): ResolvedThemeMode {
  return view?.matchMedia(PREFERS_DARK_QUERY).matches ? "dark" : "light";
}
