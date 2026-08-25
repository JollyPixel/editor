// Import Internal Dependencies
import { resolveThemeToken } from "./resolveThemeToken.ts";
import type { ThemeMode } from "./types.ts";

export type ResolvedThemeMode = Exclude<ThemeMode, "auto">;

export function ambientThemeMode(
  element: Element
): ResolvedThemeMode | null {
  const parent = flatTreeParent(element);
  if (parent !== null) {
    const parentStyle = getComputedStyle(parent);
    const carriesTheme = resolveThemeToken(parent, "--jolly-surface") !== "";
    if (carriesTheme) {
      const mode = themeModeOf(parentStyle);
      if (mode !== null) {
        return mode;
      }
    }
  }

  const active = element.ownerDocument.activeElement;
  if (active !== null) {
    const mode = themeModeOf(getComputedStyle(active));
    if (mode !== null) {
      return mode;
    }
  }

  const inherited = parent === null
    ? null
    : themeModeOf(getComputedStyle(parent));

  return inherited ?? documentThemeMode(element.ownerDocument);
}

export function documentThemeMode(
  doc: Document = document
): ResolvedThemeMode | null {
  for (const host of doc.querySelectorAll("jolly-scope")) {
    const mode = themeModeOf(getComputedStyle(host));
    if (mode !== null) {
      return mode;
    }
  }

  return null;
}

function flatTreeParent(
  element: Element
): HTMLElement | null {
  const parent = element.parentNode instanceof ShadowRoot
    ? element.parentNode.host
    : element.parentElement;

  return parent instanceof HTMLElement ? parent : null;
}

function themeModeOf(
  style: CSSStyleDeclaration
): ResolvedThemeMode | null {
  const schemes = new Set(
    style.colorScheme.split(/\s+/)
  );
  const hasLight = schemes.has("light");
  const hasDark = schemes.has("dark");

  if (hasDark && !hasLight) {
    return "dark";
  }
  if (hasLight && !hasDark) {
    return "light";
  }

  return null;
}
