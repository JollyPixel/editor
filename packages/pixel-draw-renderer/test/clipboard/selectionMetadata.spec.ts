// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  decodeSelectionMetadata,
  encodeSelectionMetadata
} from "#src/clipboard/selectionMetadata.ts";
import type {
  DecodedRasterImage,
  SelectionSnapshot
} from "#src/clipboard/types.ts";

// CONSTANTS
const kSnapshot: SelectionSnapshot = {
  rect: { x: -2, y: 4, width: 2, height: 1 },
  pixels: [
    { r: 1, g: 2, b: 3, a: 4 },
    { r: 5, g: 6, b: 7, a: 128 }
  ],
  mask: [true, false]
};

const kImage: DecodedRasterImage = {
  width: 2,
  height: 1,
  pixels: kSnapshot.pixels
};

describe("selectionMetadata", () => {
  test("encodes full and bitset masks in version 1 metadata", () => {
    const full = encodeSelectionMetadata({
      ...kSnapshot,
      mask: [true, true]
    });
    const bitset = encodeSelectionMetadata(kSnapshot);

    assert.deepStrictEqual(full.mask, { encoding: "full" });
    assert.deepStrictEqual(bitset.mask, { encoding: "bitset", data: "AQ==" });
    assert.strictEqual(bitset.pixels, "AQIDBAUGB4A=");
    assert.deepStrictEqual(
      decodeSelectionMetadata(JSON.stringify(full), kImage),
      { mask: [true, true], pixels: kSnapshot.pixels }
    );
    assert.deepStrictEqual(
      decodeSelectionMetadata(JSON.stringify(bitset), kImage),
      { mask: kSnapshot.mask, pixels: kSnapshot.pixels }
    );
  });

  test("metadata without a pixel channel still decodes, falling back to the raster", () => {
    const legacy = JSON.stringify({
      version: 1,
      rect: kSnapshot.rect,
      mask: { encoding: "full" }
    });

    assert.deepStrictEqual(
      decodeSelectionMetadata(legacy, kImage),
      { mask: [true, true], pixels: null }
    );
  });

  test("rejects a pixel channel whose length does not match the image", () => {
    const mismatched = JSON.stringify({
      version: 1,
      rect: kSnapshot.rect,
      mask: { encoding: "full" },
      pixels: "AAAA"
    });

    assert.deepStrictEqual(
      decodeSelectionMetadata(mismatched, kImage),
      { mask: [true, true], pixels: null }
    );
  });

  test("rejects malformed, unsupported, mismatched, and invalid-mask metadata", () => {
    const invalidPayloads = [
      "not-json",
      JSON.stringify({ version: 2, rect: kSnapshot.rect, mask: { encoding: "full" } }),
      JSON.stringify({
        version: 1,
        rect: { ...kSnapshot.rect, width: 3 },
        mask: { encoding: "full" }
      }),
      JSON.stringify({
        version: 1,
        rect: kSnapshot.rect,
        mask: { encoding: "bitset", data: "" }
      }),
      JSON.stringify({
        version: 1,
        rect: kSnapshot.rect,
        mask: { encoding: "bitset", data: "@@==" }
      })
    ];

    for (const payload of invalidPayloads) {
      assert.strictEqual(decodeSelectionMetadata(payload, kImage), null);
    }
  });
});
