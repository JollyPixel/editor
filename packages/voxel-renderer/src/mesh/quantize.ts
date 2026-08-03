// CONSTANTS
// Largest magnitude of a signed normalized byte, per the WebGL conversion rules.
const kSnormMax = 127;
const kUnormMax = 65535;

/** Unit-vector component to a signed normalized byte: `-1..1` → `-127..127`. */
export function toSnorm8(
  value: number
): number {
  return Math.round(clampUnit(value) * kSnormMax);
}

/** Value already in `0..1` to an unsigned normalized short. */
export function toUnorm16(
  value: number
): number {
  return Math.round(clampUnsigned(value) * kUnormMax);
}

function clampUnit(
  value: number
): number {
  if (value < -1) {
    return -1;
  }

  return value > 1 ? 1 : value;
}

function clampUnsigned(
  value: number
): number {
  if (value < 0) {
    return 0;
  }

  return value > 1 ? 1 : value;
}
