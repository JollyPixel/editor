// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  moveAxis,
  resizeAxis,
  snapValue
} from "#src/area-box/snapping.ts";

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

  test("returns the value untouched for a disabled step", () => {
    assert.equal(snapValue(3.4, 0), 3.4);
    assert.equal(snapValue(3.4, -1), 3.4);
    assert.equal(snapValue(3.4, Number.NaN), 3.4);
  });
});

describe("moveAxis", () => {
  test("passes the target through when unbounded", () => {
    assert.equal(
      moveAxis({ target: 12, size: 3 }),
      12
    );
  });

  test("keeps the whole extent inside the bounds", () => {
    const bounds = { min: 0, max: 10 };

    assert.equal(moveAxis({ target: -4, size: 3, bounds }), 0);
    assert.equal(moveAxis({ target: 9, size: 3, bounds }), 7);
    assert.equal(moveAxis({ target: 5, size: 3, bounds }), 5);
  });

  test("sticks to the lower bound when larger than the bounds", () => {
    assert.equal(
      moveAxis({ target: 4, size: 20, bounds: { min: 0, max: 10 } }),
      0
    );
  });
});

describe("resizeAxis", () => {
  test("moves the max face without touching the min corner", () => {
    const extent = resizeAxis({
      min: 2,
      size: 3,
      sign: 1,
      faceCoord: 9,
      minSize: 1
    });

    assert.deepEqual(extent, { min: 2, size: 7 });
  });

  test("moves the min face without moving the max face", () => {
    const extent = resizeAxis({
      min: 2,
      size: 3,
      sign: -1,
      faceCoord: -1,
      minSize: 1
    });

    // The max face stays at 5.
    assert.deepEqual(extent, { min: -1, size: 6 });
  });

  test("clamps at minSize instead of inverting the extent", () => {
    const grown = resizeAxis({
      min: 2,
      size: 3,
      sign: 1,
      faceCoord: -10,
      minSize: 1
    });
    assert.deepEqual(grown, { min: 2, size: 1 });

    const shrunk = resizeAxis({
      min: 2,
      size: 3,
      sign: -1,
      faceCoord: 40,
      minSize: 1
    });
    assert.deepEqual(shrunk, { min: 4, size: 1 });
  });

  test("keeps the dragged face inside the bounds", () => {
    const extent = resizeAxis({
      min: 2,
      size: 3,
      sign: 1,
      faceCoord: 40,
      minSize: 1,
      bounds: { min: 0, max: 10 }
    });

    assert.deepEqual(extent, { min: 2, size: 8 });
  });

  test("lets minSize win over a bound that is too tight", () => {
    const extent = resizeAxis({
      min: 2,
      size: 3,
      sign: 1,
      faceCoord: 2,
      minSize: 4,
      bounds: { min: 0, max: 3 }
    });

    assert.deepEqual(extent, { min: 2, size: 4 });
  });
});
