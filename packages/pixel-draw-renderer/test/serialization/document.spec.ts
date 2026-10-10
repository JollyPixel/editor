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
import type { PixelDocumentState } from "#src/sync/PixelDocumentState.ts";
import { NormalMapConfig } from "#src/normal/NormalMapConfig.ts";
import { ColorPalette } from "#src/palette/ColorPalette.ts";
import {
  createDocumentState,
  jsonBytes
} from "../helpers/document/serialization.ts";

function enableNormalMap(
  state: PixelDocumentState,
  config: NormalMapConfig
): void {
  state.apply({
    action: "normal-map-toggled",
    metadata: { config: config.toJSON() }
  });
}

describe("PixelArtDocument", () => {
  test("round-trips the palette including alpha and resets missing palettes", () => {
    const source = createDocumentState({ x: 1, y: 1 });
    const color = { r: 12, g: 34, b: 56, a: 128 };
    source.apply({
      action: "palette-color-changed",
      metadata: { index: 9, color }
    });
    const target = createDocumentState({ x: 1, y: 1 });
    const document = decodePixelArtDocument(
      encodePixelArtDocument(serializePixelDocument(source))
    );
    deserializePixelDocument(document, target);
    assert.deepEqual(target.palette.colorAt(9), color);
    delete document.palette;
    deserializePixelDocument(document, target);
    assert.deepEqual(target.palette.toJSON(), ColorPalette.create().toJSON());
  });

  test("round-trips pixels and size", () => {
    const source = createDocumentState({ x: 3, y: 2 });
    source.buffer.drawPixels(
      [{ x: 1, y: 1 }],
      {
        r: 10,
        g: 20,
        b: 30,
        a: 255
      }
    );

    const target = createDocumentState({ x: 1, y: 1 });
    deserializePixelDocument(
      decodePixelArtDocument(encodePixelArtDocument(serializePixelDocument(source))),
      target
    );

    assert.deepEqual(target.buffer.size(), { x: 3, y: 2 });
    assert.deepEqual(target.buffer.pixels(), source.buffer.pixels());
  });

  test("round-trips UV regions", () => {
    const source = createDocumentState({ x: 4, y: 4 });
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

    const target = createDocumentState({ x: 4, y: 4 });
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
    const source = createDocumentState({ x: 2, y: 2 });
    const target = createDocumentState({ x: 2, y: 2 });
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
    const source = createDocumentState({ x: 2, y: 2 });
    const normalMap = NormalMapConfig.create({ strength: 4 })
      .withZone({ regionId: "glass", settings: "off" });
    enableNormalMap(source, normalMap);
    const target = createDocumentState({ x: 2, y: 2 });

    const document = decodePixelArtDocument(
      encodePixelArtDocument(serializePixelDocument(source))
    );
    deserializePixelDocument(document, target);

    assert.deepEqual(document.normalMap, normalMap.toJSON());
    assert.deepEqual(target.normalMap?.toJSON(), normalMap.toJSON());
  });

  test("a document without normal map settings leaves the feature off", () => {
    const target = createDocumentState({ x: 2, y: 2 });
    enableNormalMap(target, NormalMapConfig.create());
    const document = serializePixelDocument(createDocumentState({ x: 2, y: 2 }));

    deserializePixelDocument(decodePixelArtDocument(jsonBytes(document)), target);

    assert.equal("normalMap" in document, false);
    assert.equal(target.normalMap, null);
  });
});

describe("createPixelArtDocument", () => {
  test("creates a transparent document of the given size", () => {
    const document = createPixelArtDocument({ x: 2, y: 3 });
    const target = createDocumentState({ x: 1, y: 1 });
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
