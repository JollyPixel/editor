// Import Internal Dependencies
import type {
  Density,
  ThemeMode
} from "./types.ts";

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
