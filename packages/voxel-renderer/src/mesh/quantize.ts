// CONSTANTS
const kSnormMax = 127;
const kUnormMax = 65535;

export function toSnorm8(
  value: number
): number {
  return Math.round(clampUnit(value) * kSnormMax);
}

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
