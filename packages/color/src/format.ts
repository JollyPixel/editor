// Import Internal Dependencies
import {
  fromRGBA8,
  toByte
} from "./convert/bytes.ts";
import {
  clampUnit,
  wrapHue
} from "./utils.ts";
import type {
  HSLA,
  RGBA,
  RGBA8
} from "./types.ts";

// CONSTANTS
/**
 * Preserves byte round trips without exposing floating-point noise.
 */
const kAlphaDigits = 3;
const kPercentDigits = 1;
const kHueDigits = 1;
const kPercentScale = 100;

/**
 * Emits lowercase full-length hex after clamping channels.
 */
export function formatHex(
  color: RGBA,
  withAlpha = false
): string {
  const rgb = pair(color.r) + pair(color.g) + pair(color.b);

  return withAlpha ?
    `#${rgb}${pair(color.a)}` :
    `#${rgb}`;
}

export function formatHex8(
  color: RGBA8,
  withAlpha = false
): string {
  return formatHex(fromRGBA8(color), withAlpha);
}

export function formatRgb(
  color: RGBA
): string {
  const {
    r,
    g,
    b
  } = bytes(color);

  return `rgb(${r}, ${g}, ${b})`;
}

export function formatRgba(
  color: RGBA
): string {
  const {
    r,
    g,
    b
  } = bytes(color);

  return `rgba(${r}, ${g}, ${b}, ${alpha(color.a)})`;
}

/**
 * Emits legacy comma syntax and uses `hsla()` for non-opaque colors.
 */
export function formatHsl(
  color: HSLA
): string {
  const h = trim(wrapHue(color.h), kHueDigits);
  const s = trim(clampUnit(color.s) * kPercentScale, kPercentDigits);
  const l = trim(clampUnit(color.l) * kPercentScale, kPercentDigits);
  const a = clampUnit(color.a);

  return a === 1 ?
    `hsl(${h}, ${s}%, ${l}%)` :
    `hsla(${h}, ${s}%, ${l}%, ${alpha(a)})`;
}

function bytes(
  color: RGBA
): { r: number; g: number; b: number; } {
  return {
    r: toByte(color.r),
    g: toByte(color.g),
    b: toByte(color.b)
  };
}

function alpha(
  value: number
): number {
  return trim(clampUnit(value), kAlphaDigits);
}

function trim(
  value: number,
  digits: number
): number {
  return Number(value.toFixed(digits));
}

function pair(
  channel: number
): string {
  return toByte(channel)
    .toString(16)
    .padStart(2, "0");
}
