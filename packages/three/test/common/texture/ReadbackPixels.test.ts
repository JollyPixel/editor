// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ReadbackPixels } from "#src/common/texture/ReadbackPixels.ts";

describe("ReadbackPixels", () => {
  test("drops the row padding of a padded readback", () => {
    const pixels = ReadbackPixels.fromReadback({
      data: Uint8Array.from([
        10, 20, 30, 255, 0, 0, 0, 0,
        40, 50, 60, 255
      ]),
      width: 1,
      height: 2,
      bottomUp: false
    });

    assert.deepEqual([...pixels.data], [10, 20, 30, 255, 40, 50, 60, 255]);
  });

  test("puts the top row first for a bottom-up readback", () => {
    const pixels = ReadbackPixels.fromReadback({
      data: Uint8Array.from([
        10, 20, 30, 255,
        40, 50, 60, 255
      ]),
      width: 1,
      height: 2,
      bottomUp: true
    });

    assert.deepEqual([...pixels.data], [40, 50, 60, 255, 10, 20, 30, 255]);
  });

  test("straightens a premultiplied edge pixel in linear light", () => {
    const pixels = ReadbackPixels.fromReadback({
      data: Uint8Array.from([
        93, 93, 93, 128,
        10, 20, 30, 255,
        0, 0, 0, 0
      ]),
      width: 3,
      height: 1,
      bottomUp: false
    });
    const [red, green, blue, alpha, ...rest] = pixels.data;

    for (const channel of [red, green, blue]) {
      assert.ok(Math.abs(channel - 128) <= 1, `channel ${channel}`);
    }
    assert.equal(alpha, 128);
    assert.deepEqual(rest, [10, 20, 30, 255, 0, 0, 0, 0]);
  });
});
