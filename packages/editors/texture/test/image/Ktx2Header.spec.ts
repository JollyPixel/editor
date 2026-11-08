// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Ktx2Header } from "#src/image/Ktx2Header.ts";
import { TextureFileError } from "#src/errors/TextureFileError.ts";

// CONSTANTS
const kIdentifier = [
  0xAB, 0x4B, 0x54, 0x58, 0x20, 0x32, 0x30, 0xBB, 0x0D, 0x0A, 0x1A, 0x0A
];

interface Ktx2Fields {
  width: number;
  height: number;
  levelCount: number;
  supercompressionScheme: number;
}

function ktx2File(
  fields: Ktx2Fields
): Uint8Array {
  const bytes = new Uint8Array(80);
  bytes.set(kIdentifier);
  const view = new DataView(bytes.buffer);
  view.setUint32(20, fields.width, true);
  view.setUint32(24, fields.height, true);
  view.setUint32(40, fields.levelCount, true);
  view.setUint32(44, fields.supercompressionScheme, true);

  return bytes;
}

describe("Ktx2Header", () => {
  test("reads the size, mip levels and supercompression of a KTX2 file", () => {
    const header = Ktx2Header.parse(ktx2File({
      width: 512,
      height: 256,
      levelCount: 10,
      supercompressionScheme: 1
    }));

    assert.deepEqual(
      {
        width: header.width,
        height: header.height,
        levels: header.levels,
        compression: header.compression
      },
      {
        width: 512,
        height: 256,
        levels: 10,
        compression: "BasisLZ"
      }
    );
  });

  test("counts one level when the file asks the loader to generate mipmaps", () => {
    const header = Ktx2Header.parse(ktx2File({
      width: 4,
      height: 4,
      levelCount: 0,
      supercompressionScheme: 0
    }));

    assert.equal(header.levels, 1);
    assert.equal(header.compression, "None");
  });

  test("reads a header that starts inside a larger buffer", () => {
    const file = ktx2File({
      width: 64,
      height: 32,
      levelCount: 1,
      supercompressionScheme: 2
    });
    const padded = new Uint8Array(file.byteLength + 8);
    padded.set(file, 8);

    const header = Ktx2Header.parse(padded.subarray(8));

    assert.equal(header.width, 64);
    assert.equal(header.compression, "Zstandard");
  });

  test("refuses a file that is not KTX2", () => {
    const png = new Uint8Array(64);
    png.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

    assert.throws(() => Ktx2Header.parse(png), TextureFileError);
    assert.throws(
      () => Ktx2Header.parse(new Uint8Array(kIdentifier)),
      TextureFileError
    );
  });
});
