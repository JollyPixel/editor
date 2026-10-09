// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { layerGridSemantics } from "../../src/controls/LayerGridSemantics.ts";

// CONSTANTS
const kMask = layerGridSemantics("mask");
const kIndex = layerGridSemantics("index");

describe("Controls.LayerGridSemantics: mask", () => {
  test("a stroke from a set bit clears every cell it crosses and keeps other bits", () => {
    const origin = 0b0110 | (2 ** 25);
    const brush = kMask.brush(origin, 1);

    assert.equal(
      brush(brush(origin, 1), 2),
      2 ** 25
    );
  });

  test("a mixed value shows every cell mixed and resolves to the pressed bit alone", () => {
    const brush = kMask.brush(undefined, 3);

    assert.equal(kMask.checked(undefined, 0), "mixed");
    assert.equal(brush(0, 3), 0b1000);
  });
});

describe("Controls.LayerGridSemantics: index", () => {
  test("a stroke selects the last crossed cell whatever the origin", () => {
    const brush = kIndex.brush(4, 1);

    assert.equal(brush(brush(4, 1), 6), 6);
    assert.equal(kIndex.checked(6, 6), "true");
    assert.equal(kIndex.checked(undefined, 0), "false");
  });
});
