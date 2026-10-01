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
export const DEFAULT_ICON_VIEW_BOX = "0 0 24 24";
const kIcons = new Map<string, SVGTemplateResult>();
const kTones = new Map<string, IconTone>();
const kViewBoxes = new Map<string, string>();

export type IconTone = typeof ICON_TONES[number];

export interface RegisterIconOptions {
  tone?: IconTone;
  /**
   * @default DEFAULT_ICON_VIEW_BOX
   */
  viewBox?: string;
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

  if (options.viewBox === undefined) {
    kViewBoxes.delete(name);
  }
  else {
    kViewBoxes.set(name, options.viewBox);
  }
}

export function iconViewBox(
  name: IconName
): string {
  return kViewBoxes.get(name) ?? DEFAULT_ICON_VIEW_BOX;
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
