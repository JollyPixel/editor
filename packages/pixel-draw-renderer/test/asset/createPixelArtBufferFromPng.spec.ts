// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { deflateSync } from "node:zlib";

// Import Internal Dependencies
import {
  createPixelArtBufferFromPng
} from "#src/asset/PixelArtDocument.ts";

// CONSTANTS
const kSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

function chunk(
  type: string,
  data: Buffer
): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);

  return Buffer.concat([
    length,
    Buffer.from(type, "ascii"),
    data,
    Buffer.alloc(4)
  ]);
}

/**
 * Unfiltered truecolor-with-alpha, one opaque pixel per row.
 */
function truecolorPng(
  width: number,
  height: number
): Uint8Array {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const stride = width * 4;
  const scanlines = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * (stride + 1)) + 1 + (x * 4);
      scanlines[offset] = x;
      scanlines[offset + 1] = y;
      scanlines[offset + 2] = 3;
      scanlines[offset + 3] = 255;
    }
  }

  return new Uint8Array(Buffer.concat([
    kSignature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(scanlines)),
    chunk("IEND", Buffer.alloc(0))
  ]));
}

describe("createPixelArtBufferFromPng", () => {
  test("sizes the buffer to the image and keeps its exact samples", async() => {
    const buffer = await createPixelArtBufferFromPng(
      truecolorPng(3, 2)
    );

    assert.deepEqual(buffer.size(), { x: 3, y: 2 });
    assert.deepEqual(
      [...buffer.pixels()].slice(0, 8),
      [0, 0, 3, 255, 1, 0, 3, 255]
    );
    assert.equal([...buffer.uvRegions].length, 0);
  });

  test("keeps the default ceiling for images smaller than it", async() => {
    const buffer = await createPixelArtBufferFromPng(
      truecolorPng(4, 4)
    );

    assert.equal(buffer.maxSize, 2048);
  });

  test("raises the ceiling so an oversized atlas still fits", async() => {
    const buffer = await createPixelArtBufferFromPng(
      truecolorPng(2049, 1)
    );

    assert.equal(buffer.maxSize, 2049);
    assert.deepEqual(buffer.size(), { x: 2049, y: 1 });
  });

  test("honours an explicit maxSize", async() => {
    const buffer = await createPixelArtBufferFromPng(
      truecolorPng(4, 4),
      { maxSize: 64 }
    );

    assert.equal(buffer.maxSize, 64);
  });
});
