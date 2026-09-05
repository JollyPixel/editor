// Import Internal Dependencies
import {
  isMixed,
  type FieldValue
} from "../field/mixed.ts";
import type {
  Vector2Axis,
  Vector2Pair,
  VectorValue
} from "./types.ts";

// CONSTANTS
const kPairs: Readonly<Record<Vector2Pair, readonly Vector2Axis[]>> = {
  xy: ["x", "y"],
  xz: ["x", "z"],
  yz: ["y", "z"]
};
const kDefaultPair: Vector2Pair = "xy";

export function axisKeysOf(
  pair: Vector2Pair | undefined
): readonly Vector2Axis[] {
  return pair === undefined
    ? kPairs[kDefaultPair]
    : kPairs[pair] ?? kPairs[kDefaultPair];
}

export function sameAxisKeys(
  a: readonly string[],
  b: readonly string[]
): boolean {
  return a.length === b.length &&
    a.every((axis, index) => axis === b[index]);
}

/*
 * Null when nothing needs moving, either because the value already carries
 * every new axis or because it cannot be read component-wise.
 */
export function rekeyVectorValue<TValue extends VectorValue<string>>(
  value: FieldValue<TValue>,
  previous: readonly string[] | null,
  next: readonly string[]
): TValue | null {
  if (isMixed(value)) {
    return null;
  }

  const record = value as Record<string, FieldValue<number>>;
  if (next.every((axis) => axis in record)) {
    return null;
  }

  const from = previous ?? Object.keys(record);

  return Object.fromEntries(
    next.map((axis, index) => {
      const source = from[index];
      const carried = source === undefined ? undefined : record[source];

      return [axis, carried ?? 0];
    })
  ) as TValue;
}
