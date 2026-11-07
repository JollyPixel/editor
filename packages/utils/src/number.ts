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
