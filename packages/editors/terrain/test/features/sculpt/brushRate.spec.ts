// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  BLEND_RATE,
  MAX_FRAME_TIME,
  RAISE_RATE,
  stampStrength
} from "#src/features/sculpt/model/brushRate.ts";

function strokeTotal(
  frames: Array<[elapsed: number, stamps: number]>
): number {
  return frames.reduce(
    (total, [elapsed, stamps]) => total + stamps * stampStrength("raise", 0.5, elapsed, stamps),
    0
  );
}

describe("stampStrength", () => {
  test("raise adds the same amount per second whether the brush holds still or moves", () => {
    const still = strokeTotal([[0.016, 1], [0.016, 1], [0.016, 1]]);
    const moving = strokeTotal([[0.016, 4], [0.016, 1], [0.016, 9]]);

    assert.ok(Math.abs(still - 0.5 * RAISE_RATE * 0.048) < 1e-12);
    assert.ok(Math.abs(moving - still) < 1e-12);
  });

  test("a slow frame counts at most the frame cap", () => {
    assert.equal(stampStrength("raise", 1, 2, 1), RAISE_RATE * MAX_FRAME_TIME);
    assert.equal(stampStrength("flatten", 1, 2, 1), BLEND_RATE * MAX_FRAME_TIME);
    assert.equal(stampStrength("flatten", 1, 0.01, 2), BLEND_RATE * 0.005);
  });
});
