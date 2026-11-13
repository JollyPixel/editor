// CONSTANTS
const kByteStep = 1024;
const kByteUnits: readonly string[] = ["B", "KiB", "MiB", "GiB", "TiB"];

export function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.min(Math.max(value, min), max);
}

export function wrap(
  value: number,
  length: number
): number {
  return ((value % length) + length) % length;
}

export function roundTo(
  value: number,
  decimals: number
): number {
  const scale = 10 ** decimals;

  const rounded = Math.round(Math.abs(value) * scale) / scale;

  return (Math.sign(value) * rounded) + 0;
}

export function formatBytes(
  bytes: number
): string {
  let scaled = bytes;
  let unit = 0;
  while (Math.abs(scaled) >= kByteStep && unit < kByteUnits.length - 1) {
    scaled /= kByteStep;
    unit++;
  }

  return unit === 0 ?
    `${Math.round(scaled)} B` :
    `${Number(scaled.toFixed(1))} ${kByteUnits[unit]}`;
}
