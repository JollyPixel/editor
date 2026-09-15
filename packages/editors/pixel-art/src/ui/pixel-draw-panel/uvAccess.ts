// Import Third-party Dependencies
import type { Mode } from "@jolly-pixel/pixel-draw.renderer";

/**
 * How much of the UV map the panel exposes.
 * - `edit`: UV mode, UV toolbar and visibility toggles.
 * - `view`: no UV mode; visibility toggles move to the bottom toolbar.
 * - `none`: no UV controls at all, including the fill clip.
 */
export type UvAccess = "edit" | "view" | "none";

export function isUvAccess(
  value: string
): value is UvAccess {
  return value === "edit" || value === "view" || value === "none";
}

export function modeAllowedBy(
  mode: Mode,
  access: UvAccess
): Mode {
  return mode === "uv" && access !== "edit" ? "paint" : mode;
}
