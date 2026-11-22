// Import Node.js Dependencies
import assert from "node:assert/strict";

// CONSTANTS
const kTolerance = 1e-9;

export function assertClose(
  actual: ArrayLike<number>,
  expected: ArrayLike<number>,
  tolerance = kTolerance
): void {
  assert.strictEqual(actual.length, expected.length);
  for (let index = 0; index < actual.length; index++) {
    const scale = Math.max(1, Math.abs(expected[index]));
    assert.ok(
      Math.abs(actual[index] - expected[index]) <= tolerance * scale,
      `expected [${Array.from(actual)}] to match [${Array.from(expected)}]`
    );
  }
}

export function assertSameRotation(
  actual: ArrayLike<number>,
  expected: ArrayLike<number>,
  tolerance = kTolerance
): void {
  const dot = (actual[0] * expected[0]) + (actual[1] * expected[1]) +
    (actual[2] * expected[2]) + (actual[3] * expected[3]);
  const length = Math.hypot(actual[0], actual[1], actual[2], actual[3]);
  assert.ok(
    Math.abs(length - 1) <= tolerance && Math.abs(dot) >= 1 - tolerance,
    `expected [${Array.from(actual)}] to rotate like [${Array.from(expected)}]`
  );
}
