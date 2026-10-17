declare const _mixedSymbol: unique symbol;

export type MixedSymbol = typeof _mixedSymbol;

export const Mixed: MixedSymbol = Symbol.for("jolly-pixel.ui.mixed") as MixedSymbol;

export type FieldValue<TValue> = TValue | MixedSymbol;

export const MIXED_PLACEHOLDER = "—";

export function isMixed<TValue>(
  value: FieldValue<TValue>
): value is MixedSymbol {
  return value === Mixed;
}
