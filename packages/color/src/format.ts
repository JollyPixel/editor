// Import Internal Dependencies
import { toByte } from "./convert/bytes.ts";
import {
  BYTE_MAX,
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
const kHexPairs = byteTable(
  (byte) => byte.toString(16).padStart(2, "0")
);
const kDecimals = byteTable(String);
const kByteAlphas = byteTable(
  (byte) => String(trim(byte / BYTE_MAX, kAlphaDigits))
);

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
  const rgb = pair(color.r / BYTE_MAX) +
    pair(color.g / BYTE_MAX) +
    pair(color.b / BYTE_MAX);

  return withAlpha ?
    `#${rgb}${pair(color.a / BYTE_MAX)}` :
    `#${rgb}`;
}

export function formatRgb(
  color: RGBA
): string {
  const r = decimal(color.r);
  const g = decimal(color.g);
  const b = decimal(color.b);

  return `rgb(${r}, ${g}, ${b})`;
}

export function formatRgba(
  color: RGBA
): string {
  const r = decimal(color.r);
  const g = decimal(color.g);
  const b = decimal(color.b);

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

function alpha(
  value: number
): string {
  const unit = clampUnit(value);
  const byte = Math.round(unit * BYTE_MAX);

  return byte / BYTE_MAX === unit ?
    kByteAlphas[byte] :
    String(trim(unit, kAlphaDigits));
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
  const byte = toByte(channel);

  return kHexPairs[byte] ?? String(byte);
}

function decimal(
  channel: number
): string {
  const byte = toByte(channel);

  return kDecimals[byte] ?? String(byte);
}

function byteTable(
  format: (byte: number) => string
): string[] {
  return Array.from(
    { length: BYTE_MAX + 1 },
    (_, byte) => format(byte)
  );
}
