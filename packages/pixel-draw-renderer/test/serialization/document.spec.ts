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
  encodePixelArtDocument,
  InvalidPixelArtDocumentError,
  deserializePixelDocument,
  serializePixelDocument
} from "#src/serialization/index.ts";
import { PixelBuffer } from "#src/buffer/PixelBuffer.ts";
import { PixelDocumentState } from "#src/sync/PixelDocumentState.ts";
import type { Vec2 } from "#src/types.ts";
import { NormalMapConfig } from "#src/normal/NormalMapConfig.ts";
import { encodePixelBytes } from "#src/serialization/pixelBytes.ts";
import { ColorPalette } from "#src/palette/ColorPalette.ts";

function stateOf(
  size: Vec2,
  maxSize?: number
): PixelDocumentState {
  return new PixelDocumentState({
    buffer: new PixelBuffer({ size, maxSize })
  });
}

function enableNormalMap(
  state: PixelDocumentState,
  config: NormalMapConfig
): void {
  state.apply({
    action: "normal-map-toggled",
    metadata: { config: config.toJSON() }
  });
}

function bytes(
  payload: unknown
): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(payload));
}

describe("PixelArtDocument", () => {
  test("round-trips the palette including alpha and resets missing palettes", () => {
    const source = stateOf({ x: 1, y: 1 });
    const color = { r: 12, g: 34, b: 56, a: 128 };
    source.apply({
      action: "palette-color-changed",
      metadata: { index: 9, color }
    });
    const target = stateOf({ x: 1, y: 1 });
    const document = decodePixelArtDocument(
      encodePixelArtDocument(serializePixelDocument(source))
    );
    deserializePixelDocument(document, target);
    assert.deepEqual(target.palette.colorAt(9), color);
    delete document.palette;
    deserializePixelDocument(document, target);
    assert.deepEqual(target.palette.toJSON(), ColorPalette.create().toJSON());
  });

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
      assert.throws(() => decodePixelArtDocument(bytes({
        ...createPixelArtDocument({ x: 1, y: 1 }),
        palette
      })), InvalidPixelArtDocumentError);
    }
  });

  test("round-trips pixels and size", () => {
    const source = stateOf({ x: 3, y: 2 });
    source.buffer.drawPixels(
      [{ x: 1, y: 1 }],
      {
        r: 10,
        g: 20,
        b: 30,
        a: 255
      }
    );

    const target = stateOf({ x: 1, y: 1 });
    deserializePixelDocument(
      decodePixelArtDocument(encodePixelArtDocument(serializePixelDocument(source))),
      target
    );

    assert.deepEqual(target.buffer.size(), { x: 3, y: 2 });
    assert.deepEqual(target.buffer.pixels(), source.buffer.pixels());
  });

  test("round-trips UV regions", () => {
    const source = stateOf({ x: 4, y: 4 });
    source.uv.restore({
      state: "stacked",
      id: "region-1",
      color: "#ff0000",
      rect: {
        x: 0,
        y: 0,
        width: 2,
        height: 2
      }
    });

    const target = stateOf({ x: 4, y: 4 });
    deserializePixelDocument(
      decodePixelArtDocument(encodePixelArtDocument(serializePixelDocument(source))),
      target
    );

    assert.deepEqual(
      [...target.uv].map((region) => region.toJSON()),
      [...source.uv].map((region) => region.toJSON())
    );
  });

  test("a document is complete state, not a patch", () => {
    const source = stateOf({ x: 2, y: 2 });
    const target = stateOf({ x: 2, y: 2 });
    target.uv.restore({
      state: "stacked",
      id: "stale",
      color: "#00ff00",
      rect: {
        x: 0,
        y: 0,
        width: 1,
        height: 1
      }
    });

    deserializePixelDocument(
      decodePixelArtDocument(encodePixelArtDocument(serializePixelDocument(source))),
      target
    );

    assert.deepEqual([...target.uv], []);
  });

  test("round-trips the normal map settings", () => {
    const source = stateOf({ x: 2, y: 2 });
    const normalMap = NormalMapConfig.create({ strength: 4 })
      .withZone({ regionId: "glass", settings: "off" });
    enableNormalMap(source, normalMap);
    const target = stateOf({ x: 2, y: 2 });

    const document = decodePixelArtDocument(
      encodePixelArtDocument(serializePixelDocument(source))
    );
    deserializePixelDocument(document, target);

    assert.deepEqual(document.normalMap, normalMap.toJSON());
    assert.deepEqual(target.normalMap?.toJSON(), normalMap.toJSON());
  });

  test("a document without normal map settings leaves the feature off", () => {
    const target = stateOf({ x: 2, y: 2 });
    enableNormalMap(target, NormalMapConfig.create());
    const document = serializePixelDocument(stateOf({ x: 2, y: 2 }));

    deserializePixelDocument(decodePixelArtDocument(bytes(document)), target);

    assert.equal("normalMap" in document, false);
    assert.equal(target.normalMap, null);
  });

  test("rejects invalid normal map settings", () => {
    assert.throws(
      () => decodePixelArtDocument(bytes({
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
      () => decodePixelArtDocument(bytes({
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
      () => decodePixelArtDocument(bytes({
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
      () => decodePixelArtDocument(bytes({
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
      () => decodePixelArtDocument(bytes({
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
      () => decodePixelArtDocument(bytes({
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
    const buffer = stateOf({ x: 2, y: 2 }, 4);

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
    const buffer = stateOf({ x: 2, y: 2 });

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

describe("createPixelArtDocument", () => {
  test("creates a transparent document of the given size", () => {
    const document = createPixelArtDocument({ x: 2, y: 3 });
    const target = stateOf({ x: 1, y: 1 });
    deserializePixelDocument(document, target);

    assert.deepEqual(document.size, { x: 2, y: 3 });
    assert.deepEqual(document.uvRegions, []);
    assert.deepEqual(target.buffer.size(), { x: 2, y: 3 });
    assert.ok(target.buffer.pixels().every((value) => value === 0));
  });

  test("encodes the given pixels as base64 RGBA8", () => {
    const pixels = new Uint8ClampedArray([1, 2, 3, 4]);

    const document = createPixelArtDocument({ x: 1, y: 1 }, pixels);

    assert.equal(document.pixels, "AQIDBA==");
  });

  test("rejects an empty size or a pixel length mismatch", () => {
    assert.throws(
      () => createPixelArtDocument({ x: 0, y: 1 }),
      InvalidPixelArtDocumentError
    );
    assert.throws(
      () => createPixelArtDocument({ x: 1, y: 1 }, new Uint8Array(3)),
      InvalidPixelArtDocumentError
    );
  });
});
