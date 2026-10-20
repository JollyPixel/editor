// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  it
} from "node:test";

// Import Internal Dependencies
import { boxesOverlap } from "../../src/browser/pointer.ts";

// CONSTANTS
const kBox = {
  x: 0,
  y: 0,
  width: 30,
  height: 30
};

describe("boxesOverlap", () => {
  it("treats boxes sharing an edge as apart", () => {
    assert.equal(boxesOverlap(kBox, { ...kBox, x: 30 }), false);
    assert.equal(boxesOverlap(kBox, { ...kBox, y: 30 }), false);
  });

  it("detects boxes crossing by a fraction of a pixel", () => {
    assert.equal(boxesOverlap(kBox, { ...kBox, x: 29.5 }), true);
  });
});
