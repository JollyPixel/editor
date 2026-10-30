// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  crc32,
  deflateSync,
  inflateSync
} from "node:zlib";

// Import Internal Dependencies
import {
  decodePng,
  encodePng,
  InvalidImageError
} from "#src/index.ts";

// CONSTANTS
const kSignature = [137, 80, 78, 71, 13, 10, 26, 10];

function chunk(
  type: string,
  content: Uint8Array
): Buffer {
  const body = Buffer.concat([Buffer.from(type, "latin1"), content]);
  const framed = Buffer.alloc(body.length + 8);
  framed.writeUInt32BE(content.length, 0);
  body.copy(framed, 4);
  framed.writeUInt32BE(crc32(body), framed.length - 4);

  return framed;
}

function png(
  width: number,
  height: number,
  header: { depth: number; colorType: number; interlace?: number; },
  rows: readonly number[]
): Uint8Array {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = header.depth;
  ihdr[9] = header.colorType;
  ihdr[12] = header.interlace ?? 0;

  return Buffer.concat([
    Buffer.from(kSignature),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.from(rows))),
    chunk("IEND", new Uint8Array(0))
  ]);
}

function inflatedImageData(
  bytes: Uint8Array
): Buffer {
  const buffer = Buffer.from(bytes);
  const start = buffer.indexOf("IDAT", 0, "latin1");

  return inflateSync(buffer.subarray(start + 4, start + 4 + buffer.readUInt32BE(start - 4)));
}

describe("PNG codec", () => {
  test("writes 16-bit samples big-endian behind each row's filter, as a PNG reader expects", async() => {
    const samples = Uint16Array.of(0x0102, 0x0304);
    const bytes = await encodePng({ width: 2, height: 1, depth: 16, samples });

    assert.deepEqual([...bytes.subarray(0, 8)], kSignature);
    const [filter, ...row] = inflatedImageData(bytes);
    assert.equal(filter, 1);
    assert.deepEqual(row, [0x01, 0x02, 0x02, 0x02]);
  });

  for (const depth of [8, 16] as const) {
    test(`keeps every ${depth}-bit sample through a round trip`, async() => {
      const top = depth === 16 ? 65535 : 255;
      const samples = Uint16Array.of(0, top, 1, top - 1, 300 % top, 7);
      const image = await decodePng(await encodePng({ width: 3, height: 2, depth, samples }));

      assert.deepEqual([image.width, image.height, image.depth], [3, 2, depth]);
      assert.deepEqual(image.samples, samples);
    });
  }

  test("undoes every row filter of a file written elsewhere", async() => {
    const image = await decodePng(png(2, 5, { depth: 8, colorType: 0 }, [
      0, 10, 20,
      1, 5, 5,
      2, 1, 1,
      3, 2, 2,
      4, 1, 1
    ]));

    assert.deepEqual([...image.samples], [
      10, 20,
      5, 10,
      6, 11,
      5, 10,
      6, 11
    ]);
  });

  test("reads the first channel of a colour image", async() => {
    const image = await decodePng(png(2, 1, { depth: 8, colorType: 6 }, [
      0, 40, 1, 2, 255, 80, 3, 4, 255
    ]));

    assert.deepEqual([...image.samples], [40, 80]);
  });

  test("refuses what cannot hold height values", async() => {
    const refused = [
      { name: "not a PNG", bytes: new Uint8Array(32) },
      { name: "a palette", bytes: png(1, 1, { depth: 8, colorType: 3 }, [0, 0]) },
      { name: "4 bits", bytes: png(1, 1, { depth: 4, colorType: 0 }, [0, 0]) },
      { name: "interlaced", bytes: png(1, 1, { depth: 8, colorType: 0, interlace: 1 }, [0, 0]) },
      { name: "missing rows", bytes: png(1, 2, { depth: 8, colorType: 0 }, [0, 0]) }
    ];
    const corrupt = png(1, 1, { depth: 8, colorType: 0 }, [0, 0]);
    corrupt[corrupt.length - 20] ^= 0xff;
    refused.push({ name: "a bad checksum", bytes: corrupt });

    for (const { name, bytes } of refused) {
      await assert.rejects(decodePng(bytes), InvalidImageError, name);
    }
  });
});
