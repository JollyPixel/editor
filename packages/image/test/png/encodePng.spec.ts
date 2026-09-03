// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { inflateSync } from "node:zlib";

// Import Internal Dependencies
import { encodePng } from "#src/png/encodePng.ts";
import { decodePng } from "#src/png/decodePng.ts";
import { chooseFilter } from "#src/png/filters.ts";
import { PNG_SIGNATURE } from "../fixtures/png.ts";

// CONSTANTS
// RGB under a low alpha, which a premultiplying canvas would return as
// (170, 85, 85, 3).
const kFragilePixels = [
  200, 100, 50, 3,
  0, 0, 0, 0
];

interface ParsedChunk {
  type: string;
  data: Buffer;
  crc: number;
}

/**
 * An independent CRC32, computed bitwise rather than from a table, so the
 * encoder's own implementation is not what validates it.
 */
function referenceCrc32(
  bytes: Buffer
): number {
  let crc = 0xFFFFFFFF;

  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? 0xEDB88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }

  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function parseChunks(
  bytes: Uint8Array
): ParsedChunk[] {
  const buffer = Buffer.from(bytes);
  const chunks: ParsedChunk[] = [];

  let offset = PNG_SIGNATURE.length;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    const crc = buffer.readUInt32BE(offset + 8 + length);
    chunks.push({
      type,
      data,
      crc
    });
    offset += 12 + length;
  }

  return chunks;
}

function image(
  width: number,
  height: number,
  samples: number[]
) {
  return {
    width,
    height,
    data: new Uint8ClampedArray(samples)
  };
}

describe("encodePng", () => {
  describe("round trip", () => {
    const cases = [
      {
        name: "opaque RGB",
        source: image(2, 2, [
          255, 0, 0, 255, 0, 255, 0, 255,
          0, 0, 255, 255, 12, 34, 56, 255
        ])
      },
      {
        name: "partial alpha, including alpha 3",
        source: image(2, 1, kFragilePixels)
      },
      {
        name: "a fully transparent image",
        source: image(3, 2, Array.from({ length: 24 }, () => 0))
      },
      {
        name: "a 1x1 image",
        source: image(1, 1, [7, 8, 9, 10])
      },
      {
        name: "a non-square image",
        source: image(4, 1, [
          1, 2, 3, 4, 5, 6, 7, 8,
          9, 10, 11, 12, 13, 14, 15, 16
        ])
      }
    ];

    for (const { name, source } of cases) {
      it(`preserves ${name} byte for byte`, async() => {
        const decoded = await decodePng(await encodePng(source));

        assert.equal(decoded.width, source.width);
        assert.equal(decoded.height, source.height);
        assert.deepEqual([...decoded.data], [...source.data]);
      });
    }

    it("preserves a gradient under every filter the heuristic may pick", async() => {
      const width = 16;
      const height = 16;
      const data = new Uint8ClampedArray(width * height * 4);
      for (let index = 0; index < data.length; index++) {
        data[index] = (index * 7) % 256;
      }
      const source = {
        width,
        height,
        data
      };

      const decoded = await decodePng(await encodePng(source));

      assert.deepEqual([...decoded.data], [...data]);
    });
  });

  describe("structure", () => {
    it("writes the signature, then IHDR, IDAT and IEND in order", async() => {
      const bytes = await encodePng(image(2, 1, kFragilePixels));

      assert.deepEqual(
        [...bytes.subarray(0, 8)],
        [...PNG_SIGNATURE]
      );
      assert.deepEqual(
        parseChunks(bytes).map(({ type }) => type),
        ["IHDR", "IDAT", "IEND"]
      );
    });

    it("declares an 8-bit, non-interlaced, truecolor-with-alpha image", async() => {
      const bytes = await encodePng(image(3, 5, new Array(60).fill(0)));
      const [ihdr] = parseChunks(bytes);

      assert.equal(ihdr.data.length, 13);
      assert.equal(ihdr.data.readUInt32BE(0), 3);
      assert.equal(ihdr.data.readUInt32BE(4), 5);
      assert.equal(ihdr.data[8], 8, "bit depth");
      assert.equal(ihdr.data[9], 6, "color type");
      assert.equal(ihdr.data[10], 0, "compression method");
      assert.equal(ihdr.data[11], 0, "filter method");
      assert.equal(ihdr.data[12], 0, "interlace method");
    });

    it("ends with an empty IEND chunk", async() => {
      const bytes = await encodePng(image(1, 1, [1, 2, 3, 4]));
      const chunks = parseChunks(bytes);
      const last = chunks[chunks.length - 1];

      assert.equal(last.type, "IEND");
      assert.equal(last.data.length, 0);
    });

    it("carries one filter byte per scanline inside the zlib stream", async() => {
      const bytes = await encodePng(image(2, 3, new Array(24).fill(0)));
      const [, idat] = parseChunks(bytes);
      const scanlines = inflateSync(idat.data);

      assert.equal(scanlines.length, 3 * ((2 * 4) + 1));
    });

    it("gives every chunk a CRC over its type and payload", async() => {
      const bytes = await encodePng(image(2, 2, new Array(16).fill(9)));

      for (const { type, data, crc } of parseChunks(bytes)) {
        assert.equal(
          crc,
          referenceCrc32(Buffer.concat([Buffer.from(type, "ascii"), data])),
          `${type} CRC`
        );
      }
    });
  });

  // chooseFilter works on bytes, so these use one byte per pixel: the
  // predictors are then readable as plain numbers rather than as channels.
  describe("chooseFilter", () => {
    const bytesPerPixel = 1;

    it("picks None for a row whose samples are already near zero", () => {
      const row = new Uint8Array([0, 3, 0, 3]);

      assert.equal(chooseFilter(row, null, bytesPerPixel), 0);
    });

    it("picks Sub for a row that repeats horizontally", () => {
      const row = new Uint8Array([90, 90, 90, 90]);

      assert.equal(chooseFilter(row, null, bytesPerPixel), 1);
    });

    it("picks Up for a row identical to the one above", () => {
      const above = new Uint8Array([10, 90, 200, 70]);
      const row = new Uint8Array(above);

      assert.equal(chooseFilter(row, above, bytesPerPixel), 2);
    });

    it("picks Average when each sample is the midpoint of its two neighbours", () => {
      const above = new Uint8Array([50, 100, 150, 200]);
      const row = new Uint8Array([0, 50, 100, 150]);

      assert.equal(chooseFilter(row, above, bytesPerPixel), 3);
    });

    it("picks Paeth when neither neighbour alone predicts well", () => {
      const above = new Uint8Array([146, 159, 245, 212]);
      const row = new Uint8Array([162, 149, 176, 185]);

      assert.equal(chooseFilter(row, above, bytesPerPixel), 4);
    });
  });

  describe("rejects", () => {
    it("a data length that disagrees with width * height", async() => {
      await assert.rejects(
        () => encodePng({
          width: 2,
          height: 2,
          data: new Uint8ClampedArray(8)
        }),
        /expected 16 bytes/
      );
    });

    it("non-positive dimensions", async() => {
      await assert.rejects(
        () => encodePng({
          width: 0,
          height: 4,
          data: new Uint8ClampedArray(0)
        }),
        /dimensions must be positive/
      );
    });

    it("non-integer dimensions", async() => {
      await assert.rejects(
        () => encodePng({
          width: 1.5,
          height: 1,
          data: new Uint8ClampedArray(4)
        }),
        /dimensions must be positive 32-bit integers/
      );
    });

    it("dimensions larger than PNG can store", async() => {
      await assert.rejects(
        () => encodePng({
          width: 0x1_0000_0000,
          height: 1,
          data: new Uint8ClampedArray(0)
        }),
        /dimensions must be positive 32-bit integers/
      );
    });
  });
});
