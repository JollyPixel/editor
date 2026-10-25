// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  createPixelArtFile,
  decodePixelArtFile,
  InvalidPixelArtFileError,
  deserializePixelDocument
} from "#src/serialization/index.ts";
import { encodePixelBytes } from "#src/serialization/pixelBytes.ts";
import { ColorPalette } from "#src/palette/ColorPalette.ts";
import {
  createDocumentState,
  jsonBytes
} from "../helpers/document/serialization.ts";

describe("PixelArtFile — invalid payloads", () => {
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
      assert.throws(() => decodePixelArtFile(jsonBytes({
        ...createPixelArtFile({ x: 1, y: 1 }),
        palette
      })), InvalidPixelArtFileError);
    }
  });

  test("rejects malformed saved UV nets", () => {
    const net = {
      id: "caps",
      name: "Caps",
      rows: [[["top"]]]
    };
    for (const uvNets of [
      null,
      { nets: null },
      { defaultId: 1, nets: [] },
      { defaultId: "", nets: [] },
      { nets: [{ ...net, id: "" }] },
      { nets: [{ ...net, rows: [] }] },
      { nets: [{ ...net, rows: [[["top"], ["top"]]] }] },
      { nets: [{ ...net, rows: [["top"]] }] },
      { nets: [net, net] }
    ]) {
      assert.throws(() => decodePixelArtFile(jsonBytes({
        ...createPixelArtFile({ x: 1, y: 1 }),
        uvNets
      })), InvalidPixelArtFileError);
    }
  });

  test("rejects invalid normal map settings", () => {
    assert.throws(
      () => decodePixelArtFile(jsonBytes({
        version: 1,
        size: { x: 1, y: 1 },
        pixels: "",
        uvRegions: [],
        normalMap: {
          defaults: { strength: 2 },
          zones: []
        }
      })),
      InvalidPixelArtFileError
    );
  });

  test("rejects a payload that is not JSON", () => {
    assert.throws(
      () => decodePixelArtFile(new TextEncoder().encode("{oops")),
      InvalidPixelArtFileError
    );
  });

  test("rejects an unsupported version", () => {
    assert.throws(
      () => decodePixelArtFile(jsonBytes({
        version: 2,
        size: { x: 1, y: 1 },
        pixels: "",
        uvRegions: []
      })),
      InvalidPixelArtFileError
    );
  });

  test("rejects a malformed size", () => {
    assert.throws(
      () => decodePixelArtFile(jsonBytes({
        version: 1,
        size: { x: 1.5, y: 1 },
        pixels: "",
        uvRegions: []
      })),
      InvalidPixelArtFileError
    );
  });

  test("rejects a size that is not positive", () => {
    assert.throws(
      () => decodePixelArtFile(jsonBytes({
        version: 1,
        size: { x: 0, y: 1 },
        pixels: "",
        uvRegions: []
      })),
      {
        name: "InvalidPixelArtFileError",
        message: /size is not a pair of positive integers/
      }
    );
  });

  test("rejects malformed UV region data", () => {
    assert.throws(
      () => decodePixelArtFile(jsonBytes({
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
      InvalidPixelArtFileError
    );
  });

  test("rejects a stacked slot that the region does not carry", () => {
    assert.throws(
      () => decodePixelArtFile(jsonBytes({
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
      InvalidPixelArtFileError
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
        name: "InvalidPixelArtFileError",
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
      InvalidPixelArtFileError
    );
  });
});
