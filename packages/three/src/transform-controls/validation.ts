// Import Third-party Dependencies
import * as THREE from "three";

export function positive(
  value: number,
  label: string
): number {
  return greaterThan(value, 0, label);
}

export function nonNegative(
  value: number,
  label: string
): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`Transform ${label} cannot be negative`);
  }

  return value;
}

export function greaterThan(
  value: number,
  lowerBound: number,
  label: string
): number {
  if (!Number.isFinite(value) || value <= lowerBound) {
    throw new RangeError(
      `Transform ${label} must be greater than ${lowerBound}`
    );
  }

  return value;
}

export function finite(
  value: number,
  label: string
): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Transform ${label} must be finite`);
  }

  return value;
}

export function normalizedOpacity(
  value: number,
  label: string
): number {
  return THREE.MathUtils.clamp(finite(value, label), 0, 1);
}

export function segments(
  value: number,
  label: string
): number {
  if (!Number.isInteger(value) || value < 3) {
    throw new RangeError(
      `Transform ${label} must be an integer of at least 3`
    );
  }

  return value;
}

export function optionalStep(
  value: number | null | undefined,
  label: string
): number | null {
  return value === null || value === undefined
    ? null
    : positive(value, label);
}
