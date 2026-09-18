// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  decodePixelBytes,
  encodePixelBytes
} from "#src/serialization/pixelBytes.ts";

describe("pixel bytes", () => {
  test("round-trips RGBA8 bytes through base64", () => {
    const pixels = new Uint8ClampedArray([
      10, 20, 30, 255,
      0, 0, 0, 0
    ]);

    const decoded = decodePixelBytes(encodePixelBytes(pixels));

    assert.ok(decoded instanceof Uint8ClampedArray);
    assert.deepStrictEqual([...decoded], [...pixels]);
  });

  test("encodes only the view, not its backing buffer", () => {
    const backing = new Uint8Array([
      1, 2, 3, 4,
      5, 6, 7, 8
    ]);
    const view = backing.subarray(4);

    const decoded = decodePixelBytes(encodePixelBytes(view));

    assert.deepStrictEqual([...decoded], [
      5, 6, 7, 8
    ]);
  });

  test("encodes an empty array as an empty string", () => {
    assert.strictEqual(encodePixelBytes(new Uint8Array(0)), "");
    assert.deepStrictEqual([...decodePixelBytes("")], []);
  });
});
