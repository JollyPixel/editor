// Import Third-party Dependencies
import type { SVGTemplateResult } from "lit";

/**
 * Names for built-in glyphs authored on the 24px icon grid.
 */
export type BuiltinIconName =
  | "chevron"
  | "close"
  | "revert"
  | "drag"
  | "lock"
  | "eye"
  | "search"
  | "check"
  | "info"
  | "warning";

/**
 * Allows consumer icons while preserving built-in name completion.
 */
export type IconName = BuiltinIconName | (string & {});

// CONSTANTS
const kIcons = new Map<string, SVGTemplateResult>();

/**
 * Registers or replaces a glyph.
 */
export function registerIcon(
  name: string,
  glyph: SVGTemplateResult
): void {
  kIcons.set(name, glyph);
}

export function getIcon(
  name: IconName
): SVGTemplateResult | null {
  return kIcons.get(name) ?? null;
}

export function hasIcon(
  name: IconName
): boolean {
  return kIcons.has(name);
}
