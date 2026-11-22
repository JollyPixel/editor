// Import Node.js Dependencies
import assert from "node:assert/strict";

// Import Internal Dependencies
import type {
  QuaternionLike,
  Vector3Like
} from "../../../src/math.ts";

export function assertQuaternionClose(
  actual: Readonly<QuaternionLike>,
  expected: Readonly<QuaternionLike>
): void {
  const dot = (actual.x * expected.x) + (actual.y * expected.y) +
    (actual.z * expected.z) + (actual.w * expected.w);
  const length = Math.hypot(actual.x, actual.y, actual.z, actual.w);
  assert.ok(
    Math.abs(length - 1) < 1e-6 && Math.abs(dot) > 1 - 1e-6,
    `expected ${quaternionArray(actual)} to match ${quaternionArray(expected)}`
  );
}

export function assertVectorClose(
  actual: Readonly<Vector3Like>,
  expected: Readonly<Vector3Like>
): void {
  assert.ok(
    Math.hypot(
      actual.x - expected.x,
      actual.y - expected.y,
      actual.z - expected.z
    ) < 1e-6,
    `expected ${vectorArray(actual)} to match ${vectorArray(expected)}`
  );
}

export function vectorArray(
  vector: Readonly<Vector3Like>
): number[] {
  return [vector.x, vector.y, vector.z];
}

function quaternionArray(
  quaternion: Readonly<QuaternionLike>
): number[] {
  return [quaternion.x, quaternion.y, quaternion.z, quaternion.w];
}
