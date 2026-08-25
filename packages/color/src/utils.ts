// CONSTANTS
const kTurn = 360;

export const BYTE_MAX = 255;

export function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.max(min, Math.min(max, value));
}

export function clampUnit(
  value: number
): number {
  return clamp(value, 0, 1);
}

export function wrapHue(
  hue: number
): number {
  return ((hue % kTurn) + kTurn) % kTurn;
}
