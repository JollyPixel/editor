// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  snapStepFor,
  snapValue
} from "#src/common/snap.ts";

describe("snapValue", () => {
  test("rounds to the closest multiple of the step", () => {
    assert.equal(snapValue(3.4, 1), 3);
    assert.equal(snapValue(3.6, 1), 4);
    assert.equal(snapValue(-3.6, 1), -4);
    assert.equal(snapValue(3.4, 2), 4);
  });

  test("snaps to absolute multiples, not to the starting offset", () => {
    assert.equal(snapValue(0.3, 1), 0);
    assert.equal(snapValue(1.3, 1), 1);
  });

  test("normalizes a negative zero result to positive zero", () => {
    assert.deepEqual(snapValue(-0.3, 1), 0);
    assert.deepEqual(snapValue(-0, 1), 0);
  });

  test("returns the value untouched for a disabled step", () => {
    assert.equal(snapValue(3.4, 0), 3.4);
    assert.equal(snapValue(3.4, -1), 3.4);
    assert.equal(snapValue(3.4, Number.NaN), 3.4);
  });
});

describe("snapStepFor", () => {
  test("reads no step while snapping is disabled", () => {
    assert.equal(snapStepFor(null, "x"), 0);
  });

  test("applies a uniform step to every axis", () => {
    assert.equal(snapStepFor(2, "x"), 2);
    assert.equal(snapStepFor(2, "y"), 2);
  });

  test("reads the per-axis step of a vector", () => {
    const snap = { x: 1, y: 0.5, z: 4 };

    assert.equal(snapStepFor(snap, "y"), 0.5);
    assert.equal(snapStepFor(snap, "z"), 4);
  });
});
