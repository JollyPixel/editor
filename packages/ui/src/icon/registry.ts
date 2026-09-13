// Import Third-party Dependencies
import {
  svg,
  type SVGTemplateResult
} from "lit";
import {
  unsafeSVG
} from "lit/directives/unsafe-svg.js";

export type BuiltinIconName =
  | "chevron"
  | "close"
  | "plus"
  | "revert"
  | "drag"
  | "lock"
  | "eye"
  | "search"
  | "check"
  | "info"
  | "warning";
export type IconName = BuiltinIconName | (string & {});
export type IconGlyph = string | SVGTemplateResult;

// CONSTANTS
const kIcons = new Map<string, SVGTemplateResult>();

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
