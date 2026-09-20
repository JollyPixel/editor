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
export const ICON_TONES = [
  "coral",
  "amber",
  "lime",
  "teal",
  "sky",
  "violet",
  "pink"
] as const;
const kIcons = new Map<string, SVGTemplateResult>();
const kTones = new Map<string, IconTone>();

export type IconTone = typeof ICON_TONES[number];

export interface RegisterIconOptions {
  tone?: IconTone;
}

export function registerIcon(
  name: string,
  glyph: IconGlyph,
  options: RegisterIconOptions = {}
): void {
  kIcons.set(
    name,
    typeof glyph === "string"
      ? svg`${unsafeSVG(glyph)}`
      : glyph
  );

  if (options.tone === undefined) {
    kTones.delete(name);
  }
  else {
    kTones.set(name, options.tone);
  }
}

export function iconTone(
  name: IconName
): IconTone | null {
  return kTones.get(name) ?? null;
}

export function isIconTone(
  value: string
): value is IconTone {
  return ICON_TONES.some((tone) => tone === value);
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
