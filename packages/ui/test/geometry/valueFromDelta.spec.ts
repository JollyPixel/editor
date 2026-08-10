// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { valueFromDelta } from "../../src/geometry/valueFromDelta.ts";

describe("Geometry.valueFromDelta", () => {
  test("returns the starting value for no travel", () => {
    assert.equal(valueFromDelta({
      start: 5,
      deltaPx: 0,
      step: 1
    }), 5);
  });

  test("advances one step per pixelsPerStep of travel", () => {
    assert.equal(valueFromDelta({
      start: 0,
      deltaPx: 4,
      step: 1,
      pixelsPerStep: 4
    }), 1);
    assert.equal(valueFromDelta({
      start: 0,
      deltaPx: 40,
      step: 1,
      pixelsPerStep: 4
    }), 10);
  });

  test("moves backwards on negative travel", () => {
    assert.equal(valueFromDelta({
      start: 10,
      deltaPx: -20,
      step: 1,
      pixelsPerStep: 4
    }), 5);
  });

  test("scales sensitivity with pixelsPerStep", () => {
    const options = {
      start: 0,
      deltaPx: 40,
      step: 1
    };

    assert.equal(
      valueFromDelta({ ...options, pixelsPerStep: 1 }),
      40
    );
    assert.equal(
      valueFromDelta({ ...options, pixelsPerStep: 20 }),
      2
    );
  });

  test("quantises to whole steps rather than tracking the pointer continuously", () => {
    const options = {
      start: 0,
      step: 5,
      pixelsPerStep: 4
    };

    assert.equal(
      valueFromDelta({ ...options, deltaPx: 5 }),
      5
    );
    assert.equal(
      valueFromDelta({ ...options, deltaPx: 7 }),
      10
    );
  });

  test("applies the multiplier, so a modifier can make the scrub fine or coarse", () => {
    const options = {
      start: 0,
      deltaPx: 40,
      step: 1,
      pixelsPerStep: 4
    };

    assert.equal(
      valueFromDelta({ ...options, multiplier: 0.1 }),
      1
    );
    assert.equal(
      valueFromDelta({ ...options, multiplier: 10 }),
      100
    );
  });

  test("clamps to min and max", () => {
    const options = {
      start: 5,
      step: 1,
      pixelsPerStep: 1,
      min: 0,
      max: 10
    };

    assert.equal(
      valueFromDelta({ ...options, deltaPx: 100 }),
      10
    );
    assert.equal(
      valueFromDelta({ ...options, deltaPx: -100 }),
      0
    );
  });

  test("does not accumulate float drift on a fractional step", () => {
    assert.equal(
      valueFromDelta({ start: 0, deltaPx: 3, step: 0.1, pixelsPerStep: 1 }),
      0.3
    );
    assert.equal(
      valueFromDelta({ start: 0, deltaPx: 7, step: 0.1, pixelsPerStep: 1 }),
      0.7
    );
    assert.equal(
      valueFromDelta({ start: 0.1, deltaPx: 2, step: 0.2, pixelsPerStep: 1 }),
      0.5
    );
  });

  test("steps from the starting value instead of snapping it onto an absolute grid", () => {
    assert.equal(
      valueFromDelta({ start: 0.15, deltaPx: 0, step: 0.1, pixelsPerStep: 1 }),
      0.15
    );
    assert.equal(
      valueFromDelta({ start: 0.15, deltaPx: 1, step: 0.1, pixelsPerStep: 1 }),
      0.25
    );
  });

  test("keeps precision finer than the step", () => {
    assert.equal(
      valueFromDelta({ start: 1.234, deltaPx: 1, step: 1, pixelsPerStep: 1 }),
      2.234
    );
  });
});
