// Import Internal Dependencies
import { MemoryStorageAdapter } from "../../storage/MemoryStorageAdapter.ts";
import type { StorageAdapter } from "../../storage/StorageAdapter.ts";
import { themeStyles } from "../../theme/styles/themeStyles.ts";

// CONSTANTS
const kTokenPattern = /--jolly-[a-z0-9-]+(?=\s*:)/g;

export interface GhostSource extends HTMLElement {
  storage: StorageAdapter;
  headerRect(): DOMRect;
}

let cachedNames: readonly string[] | null = null;

export function themeTokenNames(): readonly string[] {
  cachedNames ??= [
    ...new Set(themeStyles.cssText.match(kTokenPattern) ?? [])
  ];

  return cachedNames;
}

export function copyTheme(
  source: HTMLElement,
  target: HTMLElement
): void {
  const computed = getComputedStyle(source);
  for (const name of themeTokenNames()) {
    const value = computed.getPropertyValue(name);
    if (value !== "") {
      target.style.setProperty(name, value);
    }
  }

  target.style.setProperty(
    "color-scheme",
    computed.colorScheme
  );
  target.style.setProperty(
    "font-family",
    computed.fontFamily
  );
  target.style.setProperty(
    "font-size",
    computed.fontSize
  );
}

export function headerGhost<T extends GhostSource>(
  source: T
): T {
  const ghost = source.cloneNode(false) as T;
  Object.assign(ghost.style, {
    height: `${source.headerRect().height}px`,
    overflow: "hidden"
  });
  ghost.removeAttribute("key");
  ghost.removeAttribute("id");
  ghost.removeAttribute("dragging");
  ghost.storage = new MemoryStorageAdapter();
  ghost.inert = true;

  return ghost;
}
