// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import { DragThreshold } from "../../../../src/features/painting/interaction/DragThreshold.ts";

describe("DragThreshold", () => {
  test("stays closed while the pointer jitters under the distance", () => {
    const threshold = new DragThreshold({ x: 100, y: 100 }, 4);

    assert.equal(threshold.crossedBy({ x: 100, y: 100 }), false);
    assert.equal(threshold.crossedBy({ x: 102, y: 102 }), false);
    assert.equal(threshold.crossedBy({ x: 97, y: 101 }), false);
  });

  test("stays crossed once the pointer travels the distance", () => {
    const threshold = new DragThreshold({ x: 100, y: 100 }, 4);

    assert.equal(threshold.crossedBy({ x: 104, y: 100 }), true);
    assert.equal(threshold.crossedBy({ x: 100, y: 100 }), true);
  });
});
