// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PixelKeySet } from "#src/history/PixelKeySet.ts";

describe("PixelKeySet", () => {
  test("keeps each pixel once and lists its positions", () => {
    const keys = new PixelKeySet([{ x: 1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 3 }]);

    assert.equal(keys.pixelCount, 2);
    assert.deepEqual([...keys.positions()], [{ x: 1, y: 0 }, { x: 0, y: 3 }]);
  });

  test("overlaps on a shared pixel or a shared named key only", () => {
    const stroke = new PixelKeySet([{ x: 1, y: 0 }], ["palette:2"]);

    assert.equal(stroke.overlaps(new PixelKeySet([{ x: 1, y: 0 }])), true);
    assert.equal(stroke.overlaps(new PixelKeySet(null, ["palette:2"])), true);
    assert.equal(stroke.overlaps(new PixelKeySet([{ x: 0, y: 1 }], ["palette:3"])), false);
  });

  test("the whole texture overlaps any set holding pixels, and no set of named keys only", () => {
    const texture = new PixelKeySet("texture");

    assert.equal(texture.overlaps(new PixelKeySet([{ x: 9, y: 9 }])), true);
    assert.equal(new PixelKeySet("texture").overlaps(texture), true);
    assert.equal(texture.overlaps(new PixelKeySet(null, ["palette:0"])), false);
    assert.equal(texture.overlaps(new PixelKeySet([])), false);
  });
});
