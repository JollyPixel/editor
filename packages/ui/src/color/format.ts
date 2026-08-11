// Import Internal Dependencies
import type { RGBA } from "./types.ts";

/**
 * Formats clamped, rounded channels as lowercase `#rrggbb` or `#rrggbbaa`.
 * Includes alpha only when `withAlpha` is true.
 */
export function formatHex(
  color: RGBA,
  withAlpha = false
): string {
  const rgb = pair(color.r) + pair(color.g) + pair(color.b);

  return withAlpha
    ? `#${rgb}${pair(color.a * 255)}`
    : `#${rgb}`;
}

function pair(
  channel: number
): string {
  const clamped = Math.min(
    255,
    Math.max(0, Math.round(channel))
  );

  return clamped
    .toString(16)
    .padStart(2, "0");
}
