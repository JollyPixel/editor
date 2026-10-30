// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { decodeBrushRing } from "#src/features/brush/model/brushRingPresence.ts";
import { BRUSH_SIZE } from "#src/state/SculptSettings.ts";

describe("decodeBrushRing", () => {
  test("keeps a published ring and the null of a peer that stopped aiming", () => {
    const ring = {
      x: -12.5,
      z: 40,
      radius: 8,
      innerRadius: 4
    };

    assert.deepEqual(decodeBrushRing(JSON.parse(JSON.stringify(ring))), ring);
    assert.deepEqual(decodeBrushRing({ ...ring, innerRadius: null }), { ...ring, innerRadius: null });
    assert.equal(decodeBrushRing(null), null);
  });

  test("drops rings outside the brush size bounds or with a broken inner ring", () => {
    const ring = {
      x: 0,
      z: 0,
      radius: 8,
      innerRadius: null
    };

    for (const value of [
      "ring",
      { ...ring, x: "0" },
      { ...ring, radius: BRUSH_SIZE.max + 1 },
      { ...ring, radius: BRUSH_SIZE.min / 2 },
      { ...ring, innerRadius: 9 },
      { ...ring, innerRadius: undefined }
    ]) {
      assert.equal(decodeBrushRing(value), undefined, JSON.stringify(value));
    }
  });
});
