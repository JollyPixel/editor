// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  createPixelArtDocument,
  decodePixelArtDocument,
  InvalidPixelArtDocumentError,
  deserializePixelDocument
} from "#src/serialization/index.ts";
import { encodePixelBytes } from "#src/serialization/pixelBytes.ts";
import { ColorPalette } from "#src/palette/ColorPalette.ts";
import {
  createDocumentState,
  jsonBytes
} from "../helpers/document/serialization.ts";

describe("PixelArtDocument — invalid payloads", () => {
  test("rejects malformed saved palettes", () => {
    for (const palette of [
      null,
      [],
      ColorPalette.create().toJSON().slice(1),
      [...ColorPalette.create().toJSON(), { r: 0, g: 0, b: 0, a: 255 }],
      ColorPalette.create().toJSON().map((color) => {
        return { ...color, a: 256 };
      }),
      ColorPalette.create().toJSON().map((color) => {
        return { ...color, r: 0.5 };
      })
    ]) {
      assert.throws(() => decodePixelArtDocument(jsonBytes({
        ...createPixelArtDocument({ x: 1, y: 1 }),
        palette
      })), InvalidPixelArtDocumentError);
    }
  });

  test("rejects invalid normal map settings", () => {
    assert.throws(
      () => decodePixelArtDocument(jsonBytes({
        version: 1,
        size: { x: 1, y: 1 },
        pixels: "",
        uvRegions: [],
        normalMap: {
          defaults: { strength: 2 },
          zones: []
        }
      })),
      InvalidPixelArtDocumentError
    );
  });

  test("rejects a payload that is not JSON", () => {
    assert.throws(
      () => decodePixelArtDocument(new TextEncoder().encode("{oops")),
      InvalidPixelArtDocumentError
    );
  });

  test("rejects an unsupported version", () => {
    assert.throws(
      () => decodePixelArtDocument(jsonBytes({
        version: 2,
        size: { x: 1, y: 1 },
        pixels: "",
        uvRegions: []
      })),
      InvalidPixelArtDocumentError
    );
  });

  test("rejects a malformed size", () => {
    assert.throws(
      () => decodePixelArtDocument(jsonBytes({
        version: 1,
        size: { x: 1.5, y: 1 },
        pixels: "",
        uvRegions: []
      })),
      InvalidPixelArtDocumentError
    );
  });

  test("rejects a size that is not positive", () => {
    assert.throws(
      () => decodePixelArtDocument(jsonBytes({
        version: 1,
        size: { x: 0, y: 1 },
        pixels: "",
        uvRegions: []
      })),
      {
        name: "InvalidPixelArtDocumentError",
        message: /size is not a pair of positive integers/
      }
    );
  });

  test("rejects malformed UV region data", () => {
    assert.throws(
      () => decodePixelArtDocument(jsonBytes({
        version: 1,
        size: { x: 1, y: 1 },
        pixels: "",
        uvRegions: [
          {
            id: "broken",
            color: "#fff",
            state: "free",
            faces: {}
          }
        ]
      })),
      InvalidPixelArtDocumentError
    );
  });

  test("rejects a stacked slot that the region does not carry", () => {
    assert.throws(
      () => decodePixelArtDocument(jsonBytes({
        version: 1,
        size: { x: 1, y: 1 },
        pixels: "",
        uvRegions: [
          {
            id: "broken",
            color: "#fff",
            state: "stacked",
            rect: { x: 0, y: 0, width: 1, height: 1 },
            stackedFace: "missing"
          }
        ]
      })),
      InvalidPixelArtDocumentError
    );
  });

  test("rejects a size the buffer would refuse", () => {
    const buffer = createDocumentState({ x: 2, y: 2 }, 4);

    assert.throws(
      () => deserializePixelDocument({
        version: 1,
        size: { x: 99, y: 2 },
        pixels: encodePixelBytes(new Uint8Array(99 * 2 * 4)),
        uvRegions: []
      }, buffer),
      {
        name: "InvalidPixelArtDocumentError",
        message: /exceeds the buffer bounds/
      }
    );
  });

  test("rejects pixels shorter than the declared size", () => {
    const buffer = createDocumentState({ x: 2, y: 2 });

    assert.throws(
      () => deserializePixelDocument({
        version: 1,
        size: { x: 2, y: 2 },
        pixels: "AAAA",
        uvRegions: []
      }, buffer),
      InvalidPixelArtDocumentError
    );
  });
});
