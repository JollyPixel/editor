// Import Internal Dependencies
import type { ResolvedThemeMode } from "../../../src/theme/ambientTheme.ts";

export async function nextFrame(): Promise<void> {
  await Promise.resolve();
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

export function pickTheme(
  scope: HTMLElement,
  theme: ResolvedThemeMode
): void {
  scope.style.colorScheme = theme;
  scope.setAttribute("theme", theme);
}

export function clearTheme(
  scope: HTMLElement
): void {
  scope.style.colorScheme = "";
  scope.removeAttribute("theme");
}
