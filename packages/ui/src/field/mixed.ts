/**
 * Sentinel for a value that differs across a multi selection. Fields render it as a dash and leave
 * the underlying value alone until edited.
 *
 * `Symbol.for` so identity survives a duplicate module instance: three editors resolve this
 * package through `dist/`, and a unique symbol would make `value === Mixed` silently false there.
 * The ambient declaration exists because TypeScript forbids asserting to `unique symbol` directly,
 * and plain `symbol` would collapse `FieldValue<string>` to `string | symbol`.
 */
declare const _mixedSymbol: unique symbol;

type MixedSymbol = typeof _mixedSymbol;

export const Mixed = Symbol.for("jolly-pixel.ui.mixed") as MixedSymbol;

export type FieldValue<TValue> = TValue | MixedSymbol;

export function isMixed<TValue>(
  value: FieldValue<TValue>
): value is MixedSymbol {
  return value === Mixed;
}
