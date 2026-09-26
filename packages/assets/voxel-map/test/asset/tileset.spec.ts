// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { InvalidAssetDocumentError } from "@jolly-pixel/asset-server";
import { createPixelArtDocument } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  createTilesetDocument,
  decodeTilesetDocument,
  encodeTilesetDocument,
  parseTilesetDocument,
  TILESET_DOCUMENT_VERSION,
  tilesetDocumentFromPng
} from "#src/index.ts";
import { makeBlockDef } from "../helpers/blocks.ts";
import { opaquePng } from "../helpers/png.ts";

describe("createTilesetDocument", () => {
  test("defaults to a blank 8 by 8 tile grid at tile size 32", () => {
    const document = createTilesetDocument();

    assert.equal(document.version, TILESET_DOCUMENT_VERSION);
    assert.equal(document.tileSize, 32);
    assert.deepEqual(document.pixels.size, { x: 256, y: 256 });
    assert.deepEqual(document.blocks, []);
    assert.deepEqual(document.materialGroups, []);
  });

  test("keeps the given pixels and strips tileset ids from block tiles", () => {
    const pixels = createPixelArtDocument({ x: 16, y: 8 });
    const document = createTilesetDocument({
      tileSize: 8,
      pixels,
      blocks: [
        makeBlockDef(2, "cube", {
          defaultTexture: { col: 1, row: 0, tilesetId: "elsewhere" }
        })
      ],
      materialGroups: [{ id: "gold", metalness: 1 }]
    });

    assert.equal(document.pixels, pixels);
    assert.deepEqual(document.blocks[0].defaultTexture, { col: 1, row: 0 });
    assert.deepEqual(
      document.materialGroups.map(({ id, metalness }) => [id, metalness]),
      [["gold", 1]]
    );
  });
});

describe("tilesetDocumentFromPng", () => {
  test("wraps the image with one cube block per tile, row-major", async() => {
    const document = await tilesetDocumentFromPng(opaquePng(32, 16), {
      tileSize: 8
    });

    assert.deepEqual(document.pixels.size, { x: 32, y: 16 });
    assert.equal(document.blocks.length, 8);
    assert.deepEqual(
      document.blocks.map(({ id, defaultTexture }) => [
        id,
        defaultTexture?.col,
        defaultTexture?.row
      ]).slice(3, 6),
      [[4, 3, 0], [5, 0, 1], [6, 1, 1]]
    );
  });

  test("caps the generated blocks", async() => {
    const document = await tilesetDocumentFromPng(opaquePng(32, 16), {
      tileSize: 8,
      blockLimit: 3
    });

    assert.deepEqual(document.blocks.map(({ id }) => id), [1, 2, 3]);
  });
});

describe("tileset document codec", () => {
  test("round-trips through bytes", async() => {
    const document = await tilesetDocumentFromPng(opaquePng(16, 16), {
      tileSize: 8
    });

    assert.deepEqual(
      decodeTilesetDocument(encodeTilesetDocument(document)),
      document
    );
  });

  test("rejects a document that is not JSON", () => {
    assert.throws(
      () => decodeTilesetDocument(new TextEncoder().encode("{")),
      InvalidAssetDocumentError
    );
  });

  test("rejects an unsupported version, tile size, pixels or blocks", () => {
    const valid = createTilesetDocument({ tileSize: 8, size: { x: 8, y: 8 } });

    for (const [name, broken] of [
      ["version", { ...valid, version: 2 }],
      ["tile size", { ...valid, tileSize: 0 }],
      ["pixels", { ...valid, pixels: { size: { x: 1, y: 1 } } }],
      ["blocks", { ...valid, blocks: {} }],
      ["block id", { ...valid, blocks: [makeBlockDef(0x10000, "cube")] }],
      ["block surface", {
        ...valid,
        blocks: [makeBlockDef(1, "cube", { alphaCutoff: 2 })]
      }],
      ["material groups", { ...valid, materialGroups: null }]
    ] as const) {
      assert.throws(
        () => parseTilesetDocument(broken),
        InvalidAssetDocumentError,
        name
      );
    }
    assert.deepEqual(parseTilesetDocument(valid), valid);
  });
});
