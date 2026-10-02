// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { crc32 as zlibCrc32 } from "node:zlib";

// Import Internal Dependencies
import { crc32 } from "#src/png/crc32.ts";

describe("crc32", () => {
  it("matches the standard check value", () => {
    assert.equal(crc32(new TextEncoder().encode("123456789")), 0xCBF43926);
  });

  it("matches zlib for every length around the 8-byte block size", () => {
    const bytes = Uint8Array.from({ length: 40 }, (_, index) => index * 37);

    for (let length = 0; length <= bytes.length; length++) {
      const slice = bytes.subarray(0, length);

      assert.equal(crc32(slice), zlibCrc32(slice), `length ${length}`);
    }
  });

  it("matches zlib on an unaligned view of a large buffer", () => {
    const bytes = Uint8Array.from(
      { length: 70_003 },
      (_, index) => (index * 2_654_435_761) >>> 24
    ).subarray(3);

    assert.equal(crc32(bytes), zlibCrc32(bytes));
  });
});
