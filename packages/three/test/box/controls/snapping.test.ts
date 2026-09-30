// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  moveAxis,
  resizeAxis
} from "#src/box/controls/snapping.ts";

describe("moveAxis", () => {
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
