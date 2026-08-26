// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { deflateSync } from "node:zlib";

// Import Internal Dependencies
import { decodePng } from "#src/image/decodePng.ts";

// CONSTANTS
const kSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

/**
 * The decoder never verifies CRCs, so the trailing four bytes stay zero.
 */
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

function header(
  width: number,
  height: number,
  colorType: number,
  options: { bitDepth?: number; interlace?: number; } = {}
): Buffer {
  const { bitDepth = 8, interlace = 0 } = options;
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = bitDepth;
  data[9] = colorType;
  data[12] = interlace;

  return chunk("IHDR", data);
}

function png(
  chunks: Buffer[]
): Uint8Array {
  return new Uint8Array(
    Buffer.concat([kSignature, ...chunks, chunk("IEND", Buffer.alloc(0))])
  );
}

describe("decodePng", () => {
  it("decodes an unfiltered truecolor-with-alpha image", async() => {
    const scanlines = Buffer.from([
      0, 255, 0, 0, 255, 0, 255, 0, 128,
      0, 0, 0, 255, 255, 10, 20, 30, 40
    ]);
    const image = png([
      header(2, 2, 6),
      chunk("IDAT", deflateSync(scanlines))
    ]);

    const { width, height, pixels } = await decodePng(image);

    assert.equal(width, 2);
    assert.equal(height, 2);
    assert.deepEqual([...pixels], [
      255, 0, 0, 255, 0, 255, 0, 128,
      0, 0, 255, 255, 10, 20, 30, 40
    ]);
  });

  it("reverses the Sub, Up and Paeth scanline filters", async() => {
    const scanlines = Buffer.from([
      1, 10, 20, 30, 5, 5, 5,
      2, 1, 1, 1, 1, 1, 1,
      4, 0, 0, 0, 0, 0, 0
    ]);
    const image = png([
      header(2, 3, 2),
      chunk("IDAT", deflateSync(scanlines))
    ]);

    const { pixels } = await decodePng(image);

    assert.deepEqual([...pixels], [
      10, 20, 30, 255, 15, 25, 35, 255,
      11, 21, 31, 255, 16, 26, 36, 255,
      11, 21, 31, 255, 16, 26, 36, 255
    ]);
  });

  it("expands an indexed image through its palette and transparency table", async() => {
    const scanlines = Buffer.from([0, 0, 1]);
    const image = png([
      header(2, 1, 3),
      chunk("PLTE", Buffer.from([1, 2, 3, 4, 5, 6])),
      chunk("tRNS", Buffer.from([64])),
      chunk("IDAT", deflateSync(scanlines))
    ]);

    const { pixels } = await decodePng(image);

    assert.deepEqual([...pixels], [1, 2, 3, 64, 4, 5, 6, 255]);
  });

  it("joins image data split across several IDAT chunks", async() => {
    const deflated = deflateSync(Buffer.from([0, 9, 8, 7]));
    const image = png([
      header(1, 1, 2),
      chunk("IDAT", deflated.subarray(0, 3)),
      chunk("IDAT", deflated.subarray(3))
    ]);

    const { pixels } = await decodePng(image);

    assert.deepEqual([...pixels], [9, 8, 7, 255]);
  });

  it("rejects payloads and formats it cannot read", async() => {
    await assert.rejects(
      () => decodePng(new Uint8Array(16)),
      /not a PNG/
    );
    await assert.rejects(
      () => decodePng(png([
        header(1, 1, 6, { bitDepth: 16 }),
        chunk("IDAT", deflateSync(Buffer.alloc(9)))
      ])),
      /only 8-bit images/
    );
    await assert.rejects(
      () => decodePng(png([
        header(1, 1, 6, { interlace: 1 }),
        chunk("IDAT", deflateSync(Buffer.alloc(5)))
      ])),
      /interlaced/
    );
    await assert.rejects(
      () => decodePng(png([
        header(1, 1, 3),
        chunk("IDAT", deflateSync(Buffer.alloc(2)))
      ])),
      /no PLTE chunk/
    );
  });
});
