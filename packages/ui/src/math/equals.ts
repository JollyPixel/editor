// Import Internal Dependencies
import { isMixed } from "../field/mixed.ts";
import type {
  QuatLike,
  VectorValue
} from "./types.ts";

export function quatEquals(
  a: QuatLike,
  b: QuatLike
): boolean {
  return Object.is(a.x, b.x) &&
    Object.is(a.y, b.y) &&
    Object.is(a.z, b.z) &&
    Object.is(a.w, b.w);
}

/**
 * Component-wise equality for `VectorValue`, including per-axis `Mixed`.
 * Whole-value `Mixed` only equals itself.
 */
export function vectorValueEquals(
  a: VectorValue<string>,
  b: VectorValue<string>
): boolean {
  if (isMixed(a) || isMixed(b)) {
    return a === b;
  }

  const keys = new Set([
    ...Object.keys(a),
    ...Object.keys(b)
  ]);

  for (const key of keys) {
    const av = a[key];
    const bv = b[key];

    if (isMixed(av) || isMixed(bv)) {
      if (av !== bv) {
        return false;
      }
      continue;
    }

    if (!Object.is(av, bv)) {
      return false;
    }
  }

  return true;
}

/**
 * `hasChanged` for reactive `value`/`default` properties, so re-assigning a
 * fresh but structurally equal object does not repaint.
 */
export function vectorValueHasChanged(
  value: unknown,
  oldValue: unknown
): boolean {
  if (isPlainRecord(value) && isPlainRecord(oldValue)) {
    return !vectorValueEquals(
      value as VectorValue<string>,
      oldValue as VectorValue<string>
    );
  }

  return value !== oldValue;
}

export function quatHasChanged(
  value: unknown,
  oldValue: unknown
): boolean {
  if (isQuatLike(value) && isQuatLike(oldValue)) {
    return !quatEquals(value, oldValue);
  }

  return value !== oldValue;
}

function isPlainRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isQuatLike(
  value: unknown
): value is QuatLike {
  return isPlainRecord(value) &&
    typeof value.x === "number" &&
    typeof value.y === "number" &&
    typeof value.z === "number" &&
    typeof value.w === "number";
}
