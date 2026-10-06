// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import { MarqueeDraft } from "../../../src/features/marquee/MarqueeDraft.ts";

describe("MarqueeDraft", () => {
  test("starts as the single pressed cell", () => {
    const draft = MarqueeDraft.begin("Ground", { x: 2, y: 1, z: 2 });

    assert.deepEqual(draft.region.toJSON(), {
      min: { x: 2, y: 1, z: 2 },
      max: { x: 3, y: 2, z: 3 }
    });
  });

  test("spans every axis between the start cell and the corner, below the start too", () => {
    const draft = MarqueeDraft
      .begin("Ground", { x: 2, y: 1, z: 2 })
      .stretchedTo({ x: -1, y: -2, z: 3 });

    assert.deepEqual(draft.region.toJSON(), {
      min: { x: -1, y: -2, z: 2 },
      max: { x: 3, y: 2, z: 4 }
    });
  });

  test("compares by layer and region", () => {
    const draft = MarqueeDraft.begin("Ground", { x: 0, y: 0, z: 0 });

    assert.ok(draft.stretchedTo({ x: 0, y: 0, z: 0 }).equals(draft));
    assert.ok(!draft.stretchedTo({ x: 0, y: 1, z: 0 }).equals(draft));
    assert.ok(
      !MarqueeDraft.begin("Roof", { x: 0, y: 0, z: 0 }).equals(draft)
    );
  });
});
