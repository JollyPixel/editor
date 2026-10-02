// Import Internal Dependencies
import {
  isMixed,
  type FieldValue
} from "../field/mixed.ts";
import { isQuatLike } from "./guards.ts";
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

  return ownComponentsMatch(a, b) && ownComponentsMatch(b, a);
}

function ownComponentsMatch(
  source: Record<string, FieldValue<number>>,
  other: Record<string, FieldValue<number>>
): boolean {
  for (const key in source) {
    if (
      Object.hasOwn(source, key) &&
      !Object.is(source[key], other[key])
    ) {
      return false;
    }
  }

  return true;
}

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
