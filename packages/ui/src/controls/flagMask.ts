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

export function toggleFlag(
  mask: number,
  bit: number
): number {
  return setFlag(
    mask,
    bit,
    !hasFlag(mask, bit)
  );
}

/**
 * Returns selected bits in declaration order.
 */
export function selectedFlags(
  mask: number,
  available: readonly number[]
): number[] {
  return available.filter(
    (bit) => hasFlag(mask, bit)
  );
}

export function maskFromFlags(
  bits: readonly number[]
): number {
  return bits.reduce(
    (mask, bit) => normalizeMask(mask | normalizeMask(bit)),
    0
  );
}
