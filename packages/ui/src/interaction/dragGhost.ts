// Import Internal Dependencies
import { MemoryStorageAdapter } from "../storage/MemoryStorageAdapter.ts";
import type { StorageAdapter } from "../storage/StorageAdapter.ts";
import { themeStyles } from "../theme/themeStyles.ts";

// CONSTANTS
const kTokenPattern = /--jolly-[a-z0-9-]+(?=\s*:)/g;

/**
 * A container a drag can clone its ghost from.
 */
export interface GhostSource extends HTMLElement {
  storage: StorageAdapter;
  /** Client rect of the chrome the ghost keeps. */
  headerRect(): DOMRect;
}

let cachedNames: readonly string[] | null = null;

/**
 * Theme token names a scope host declares.
 *
 * Read from the stylesheet that declares them rather than hand-listed, so the
 * two cannot drift: a token added to the theme is carried onto a ghost without
 * anyone remembering to list it here. Computed once and kept.
 */
export function themeTokenNames(): readonly string[] {
  cachedNames ??= [
    ...new Set(themeStyles.cssText.match(kTokenPattern) ?? [])
  ];

  return cachedNames;
}

/**
 * Copies the resolved theme onto an element standing outside every scope host.
 *
 * A ghost renders in `document.body`, where none of the tokens are declared,
 * and would otherwise paint itself out of the usage-site fallbacks alone. One
 * level of copying is enough because the computed value of a custom property
 * already has its own `var()` references substituted. `color-scheme` comes
 * along because the tokens are built on `light-dark()`, which resolves against
 * the scheme in force rather than where it was declared.
 */
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

/**
 * Clones a container down to the chrome a drag needs to show.
 *
 * The clone is a real element: once connected it renders its own shadow DOM,
 * so the ghost matches the source without replicating any of its styling. It
 * drops the light DOM, whose controls hold state a shallow clone cannot carry
 * and whose contents are not what the gesture is about. Storage is swapped for
 * a scratch adapter because a container restores its open state on connect and
 * would otherwise reopen itself a microtask after being built.
 *
 * The clone is squeezed to its header rather than folded shut. Folding would
 * turn a chevron the other way and report a state the container being carried
 * is not in; clipping leaves every control reading exactly as its source does.
 *
 * Callers reassign whatever the source held as an unreflected property, `label`
 * and `title` above all, since only attributes survive a clone.
 */
export function headerGhost<T extends GhostSource>(
  source: T
): T {
  const ghost = source.cloneNode(false) as T;
  Object.assign(ghost.style, {
    height: `${source.headerRect().height}px`,
    overflow: "hidden"
  });
  // A throwaway replica answers for nothing: leaving the identity on it would
  // put a second element under the same key and id into the document, where
  // "getElementById" and every key-based query would find it.
  ghost.removeAttribute("key");
  ghost.removeAttribute("id");
  // The source dims itself in place. A ghost that did the same would read as a
  // second dropped element rather than the one being carried.
  ghost.removeAttribute("dragging");
  ghost.storage = new MemoryStorageAdapter();
  ghost.inert = true;

  return ghost;
}
