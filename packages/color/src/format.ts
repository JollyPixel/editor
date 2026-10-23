// Import Internal Dependencies
import {
  clampByte,
  toByte
} from "./convert/bytes.ts";
import {
  BYTE_MAX,
  clampUnit,
  wrapHue
} from "./math.ts";
import type {
  HSLA,
  OKLCHA,
  RGBA,
  RGBA8
} from "./types.ts";

// CONSTANTS
const kAlphaDigits = 3;
const kPercentDigits = 1;
const kHueDigits = 1;
const kPercentScale = 100;
const kOklchLightnessDigits = 2;
const kOklchChromaDigits = 4;
const kOklchHueDigits = 2;
const kHexPairs = byteTable(
  (byte) => byte.toString(16).padStart(2, "0")
);
const kDecimals = byteTable(String);
const kByteAlphas = byteTable(
  (byte) => String(trim(byte / BYTE_MAX, kAlphaDigits))
);

export function formatHex(
  color: RGBA,
  withAlpha = false
): string {
  const rgb = hex(toByte(color.r)) +
    hex(toByte(color.g)) +
    hex(toByte(color.b));

  return withAlpha ?
    `#${rgb}${hex(toByte(color.a))}` :
    `#${rgb}`;
}

export function formatHex8(
  color: RGBA8,
  withAlpha = false
): string {
  const rgb = hex(clampByte(color.r)) +
    hex(clampByte(color.g)) +
    hex(clampByte(color.b));

  return withAlpha ?
    `#${rgb}${hex(clampByte(color.a))}` :
    `#${rgb}`;
}

export function formatRgb(
  color: RGBA
): string {
  const r = decimal(toByte(color.r));
  const g = decimal(toByte(color.g));
  const b = decimal(toByte(color.b));

  return `rgb(${r}, ${g}, ${b})`;
}

export function formatRgb8(
  color: RGBA8
): string {
  const r = decimal(clampByte(color.r));
  const g = decimal(clampByte(color.g));
  const b = decimal(clampByte(color.b));

  return `rgb(${r}, ${g}, ${b})`;
}

export function formatRgba(
  color: RGBA
): string {
  const r = decimal(toByte(color.r));
  const g = decimal(toByte(color.g));
  const b = decimal(toByte(color.b));

  return `rgba(${r}, ${g}, ${b}, ${alpha(color.a)})`;
}

export function formatRgba8(
  color: RGBA8
): string {
  const r = decimal(clampByte(color.r));
  const g = decimal(clampByte(color.g));
  const b = decimal(clampByte(color.b));

  return `rgba(${r}, ${g}, ${b}, ${kByteAlphas[clampByte(color.a)]})`;
}

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

export function formatOklch(
  color: OKLCHA
): string {
  const l = trim(clampUnit(color.l) * kPercentScale, kOklchLightnessDigits);
  const c = trim(Math.max(color.c, 0), kOklchChromaDigits);
  const h = trim(wrapHue(color.h), kOklchHueDigits);
  const a = clampUnit(color.a);

  return a === 1 ?
    `oklch(${l}% ${c} ${h})` :
    `oklch(${l}% ${c} ${h} / ${alpha(a)})`;
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

function byteTable(
  format: (byte: number) => string
): string[] {
  return Array.from(
    { length: BYTE_MAX + 1 },
    (_, byte) => format(byte)
  );
}

function hex(
  byte: number
): string {
  return kHexPairs[byte] ?? String(byte);
}

function decimal(
  byte: number
): string {
  return kDecimals[byte] ?? String(byte);
}
