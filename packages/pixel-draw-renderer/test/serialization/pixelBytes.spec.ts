// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  decodePixelBytes,
  decodePngPixels,
  encodePixelBytes,
  encodePngPixels
} from "#src/serialization/pixelBytes.ts";
import {
  InvalidPixelArtDocumentError
} from "#src/serialization/errors/InvalidPixelArtDocumentError.ts";

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
});

describe("PNG pixels", () => {
  const size = { x: 2, y: 2 };
  const pixels = new Uint8ClampedArray([
    10, 20, 30, 255,
    0, 0, 0, 0,
    255, 0, 128, 64,
    1, 2, 3, 4
  ]);

  test("round-trips RGBA8 bytes exactly, alpha included", async() => {
    const encoded = await encodePngPixels(pixels, size);

    assert.strictEqual(encoded.format, "png");
    assert.deepStrictEqual(
      [...await decodePngPixels(encoded, size)],
      [...pixels]
    );
  });

  test("reads the pixels before its first await", async() => {
    const source = pixels.slice();

    const encoding = encodePngPixels(source, size);
    source.fill(0);

    assert.deepStrictEqual(
      [...await decodePngPixels(await encoding, size)],
      [...pixels]
    );
  });

  test("encodes only the pixels within the size", async() => {
    const larger = new Uint8ClampedArray(pixels.length + 8);
    larger.set(pixels);

    const encoded = await encodePngPixels(larger, size);

    assert.deepStrictEqual(
      [...await decodePngPixels(encoded, size)],
      [...pixels]
    );
  });

  test("rejects PNG pixels of another size", async() => {
    const encoded = await encodePngPixels(pixels, size);

    await assert.rejects(
      decodePngPixels(encoded, { x: 4, y: 1 }),
      InvalidPixelArtDocumentError
    );
  });
});
