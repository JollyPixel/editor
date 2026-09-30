// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";

// Import Internal Dependencies
import { encodePng } from "#src/png/encodePng.ts";
import { decodePng } from "#src/png/decodePng.ts";
import type { DecodedImage } from "#src/types.ts";
import {
  PNG_SIGNATURE,
  FRAGILE_PIXELS
} from "../fixtures/png.ts";

interface ParsedChunk {
  type: string;
  data: Buffer;
  crc: number;
}

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
  samples: ArrayLike<number>
): DecodedImage {
  return {
    width,
    height,
    data: new Uint8ClampedArray(samples)
  };
}

function noisyImage(
  size: number
): DecodedImage {
  return image(
    size,
    size,
    Array.from({ length: size * size * 4 }, (_, index) => (index * 97) % 251)
  );
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
        source: image(2, 1, FRAGILE_PIXELS)
      },
      {
        name: "a fully transparent image",
        source: image(3, 2, new Array(24).fill(0))
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
      },
      {
        name: "a noisy multi-row image",
        source: noisyImage(8)
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
  });

  describe("structure", () => {
    it("writes the signature, then IHDR, IDAT and an empty IEND", async() => {
      const bytes = await encodePng(image(2, 1, FRAGILE_PIXELS));
      const chunks = parseChunks(bytes);

      assert.deepEqual(
        [...bytes.subarray(0, 8)],
        [...PNG_SIGNATURE]
      );
      assert.deepEqual(
        chunks.map(({ type }) => type),
        ["IHDR", "IDAT", "IEND"]
      );
      assert.equal(chunks[2].data.length, 0);
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

  describe("rejects", () => {
    const cases = [
      {
        name: "a data length that disagrees with width * height",
        source: image(2, 2, new Array(8).fill(0)),
        message: /expected 16 bytes/
      },
      {
        name: "non-positive dimensions",
        source: image(0, 4, []),
        message: /dimensions must be positive/
      },
      {
        name: "non-integer dimensions",
        source: image(1.5, 1, new Array(4).fill(0)),
        message: /dimensions must be positive 32-bit integers/
      },
      {
        name: "dimensions larger than PNG can store",
        source: image(0x1_0000_0000, 1, []),
        message: /dimensions must be positive 32-bit integers/
      }
    ];

    for (const { name, source, message } of cases) {
      it(name, async() => {
        await assert.rejects(
          () => encodePng(source),
          {
            name: "InvalidPngError",
            message
          }
        );
      });
    }
  });
});
