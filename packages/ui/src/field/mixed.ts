/**
 * Sentinel for values that differ across a multi-selection.
 */
declare const _mixedSymbol: unique symbol;

type MixedSymbol = typeof _mixedSymbol;

/**
 * Preserves the `unique symbol` type of the global sentinel.
 */
export const Mixed: MixedSymbol = Symbol.for("jolly-pixel.ui.mixed") as MixedSymbol;

export type FieldValue<TValue> = TValue | MixedSymbol;

/**
 * Mixed-value placeholder; the em dash avoids a negative-sign ambiguity.
 */
export const MIXED_PLACEHOLDER = "—";

export function isMixed<TValue>(
  value: FieldValue<TValue>
): value is MixedSymbol {
  return value === Mixed;
}
