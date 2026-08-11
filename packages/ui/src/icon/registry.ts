// Import Third-party Dependencies
import {
  svg,
  type SVGTemplateResult
} from "lit";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";

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

/**
 * SVG markup or a Lit SVG template that renders an icon glyph.
 */
export type IconGlyph = string | SVGTemplateResult;

// CONSTANTS
const kIcons = new Map<string, SVGTemplateResult>();

/**
 * Registers or replaces a glyph.
 */
export function registerIcon(
  name: string,
  glyph: IconGlyph
): void {
  kIcons.set(
    name,
    typeof glyph === "string"
      ? svg`${unsafeSVG(glyph)}`
      : glyph
  );
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
