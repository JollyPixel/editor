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
  encodePixelArtFile,
  InvalidPixelArtFileError,
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

describe("PixelArtFile", () => {
  test("round-trips the palette including alpha and resets missing palettes", () => {
    const source = createDocumentState({ x: 1, y: 1 });
    const color = { r: 12, g: 34, b: 56, a: 128 };
    source.apply({
      action: "palette-color-changed",
      metadata: { index: 9, color }
    });
    const target = createDocumentState({ x: 1, y: 1 });
    const file = decodePixelArtFile(
      encodePixelArtFile(serializePixelDocument(source))
    );
    deserializePixelDocument(file, target);
    assert.deepEqual(target.palette.colorAt(9), color);
    delete file.palette;
    deserializePixelDocument(file, target);
    assert.deepEqual(target.palette.toJSON(), ColorPalette.create().toJSON());
  });

  test("round-trips saved UV nets and leaves them out of files without any", () => {
    const source = createDocumentState({ x: 1, y: 1 });
    assert.equal("uvNets" in serializePixelDocument(source), false);
    source.apply({
      action: "uv-net-saved",
      metadata: {
        net: {
          id: "caps",
          name: "Caps",
          rows: [[["top", "bottom"], null, ["front"]]]
        }
      }
    });
    source.apply({
      action: "uv-net-default-changed",
      metadata: { id: "caps" }
    });
    const target = createDocumentState({ x: 1, y: 1 });
    deserializePixelDocument(
      decodePixelArtFile(encodePixelArtFile(serializePixelDocument(source))),
      target
    );
    assert.deepEqual(target.uvNets.toJSON(), source.uvNets.toJSON());
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
      decodePixelArtFile(encodePixelArtFile(serializePixelDocument(source))),
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
      decodePixelArtFile(encodePixelArtFile(serializePixelDocument(source))),
      target
    );

    assert.deepEqual(
      [...target.uv].map((region) => region.toJSON()),
      [...source.uv].map((region) => region.toJSON())
    );
  });

  test("a file is complete state, not a patch", () => {
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
      decodePixelArtFile(encodePixelArtFile(serializePixelDocument(source))),
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

    const file = decodePixelArtFile(
      encodePixelArtFile(serializePixelDocument(source))
    );
    deserializePixelDocument(file, target);

    assert.deepEqual(file.normalMap, normalMap.toJSON());
    assert.deepEqual(target.normalMap?.toJSON(), normalMap.toJSON());
  });

  test("a file without normal map settings leaves the feature off", () => {
    const target = createDocumentState({ x: 2, y: 2 });
    enableNormalMap(target, NormalMapConfig.create());
    const file = serializePixelDocument(createDocumentState({ x: 2, y: 2 }));

    deserializePixelDocument(decodePixelArtFile(jsonBytes(file)), target);

    assert.equal("normalMap" in file, false);
    assert.equal(target.normalMap, null);
  });
});

describe("createPixelArtFile", () => {
  test("creates a transparent file of the given size", () => {
    const file = createPixelArtFile({ x: 2, y: 3 });
    const target = createDocumentState({ x: 1, y: 1 });
    deserializePixelDocument(file, target);

    assert.deepEqual(file.size, { x: 2, y: 3 });
    assert.deepEqual(file.uvRegions, []);
    assert.deepEqual(target.buffer.size(), { x: 2, y: 3 });
    assert.ok(target.buffer.pixels().every((value) => value === 0));
  });

  test("encodes the given pixels as base64 RGBA8", () => {
    const pixels = new Uint8ClampedArray([1, 2, 3, 4]);

    const file = createPixelArtFile({ x: 1, y: 1 }, pixels);

    assert.equal(file.pixels, "AQIDBA==");
  });

  test("rejects an empty size or a pixel length mismatch", () => {
    assert.throws(
      () => createPixelArtFile({ x: 0, y: 1 }),
      InvalidPixelArtFileError
    );
    assert.throws(
      () => createPixelArtFile({ x: 1, y: 1 }, new Uint8Array(3)),
      InvalidPixelArtFileError
    );
  });
});
