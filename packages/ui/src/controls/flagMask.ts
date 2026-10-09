/**
 * Pure unsigned 32-bit mask helpers.
 */
export function normalizeMask(
  mask: number
): number {
  return Number.isFinite(mask) ? mask >>> 0 : 0;
}

export function hasFlag(
  mask: number,
  bit: number
): boolean {
  return (normalizeMask(mask) & normalizeMask(bit)) !== 0;
}

export function setFlag(
  mask: number,
  bit: number,
  enabled: boolean
): number {
  const base = normalizeMask(mask);
  const flag = normalizeMask(bit);

  return normalizeMask(
    enabled ? base | flag : base & ~flag
  );
}

export function bitAt(
  index: number
): number {
  return normalizeMask(2 ** index);
}
