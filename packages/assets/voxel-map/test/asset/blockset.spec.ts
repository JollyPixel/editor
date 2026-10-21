// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { InvalidAssetFileError } from "@jolly-pixel/asset-server";
import { createPixelArtFile } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  createBlocksetFile,
  decodeBlocksetFile,
  encodeBlocksetFile,
  parseBlocksetFile,
  BLOCKSET_FILE_VERSION,
  blocksetFileFromPng
} from "#src/index.ts";
import { makeBlockDef } from "../helpers/blocks.ts";
import { opaquePng } from "../helpers/png.ts";

describe("createBlocksetFile", () => {
  test("defaults to a blank 8 by 8 tile grid at tile size 32", () => {
    const file = createBlocksetFile();

    assert.equal(file.version, BLOCKSET_FILE_VERSION);
    assert.equal(file.tileSize, 32);
    assert.deepEqual(file.pixels.size, { x: 256, y: 256 });
    assert.deepEqual(file.blocks, []);
    assert.deepEqual(file.materialGroups, []);
  });

  test("keeps the given pixels and strips blockset ids from block tiles", () => {
    const pixels = createPixelArtFile({ x: 16, y: 8 });
    const file = createBlocksetFile({
      tileSize: 8,
      pixels,
      blocks: [
        makeBlockDef(2, "cube", {
          defaultTexture: { col: 1, row: 0, blocksetId: "elsewhere" }
        })
      ],
      materialGroups: [{ id: "gold", metalness: 1 }]
    });

    assert.equal(file.pixels, pixels);
    assert.deepEqual(file.blocks[0].defaultTexture, { col: 1, row: 0 });
    assert.deepEqual(
      file.materialGroups.map(({ id, metalness }) => [id, metalness]),
      [["gold", 1]]
    );
  });
});

describe("blocksetFileFromPng", () => {
  test("wraps the image with one cube block per tile, row-major", async() => {
    const file = await blocksetFileFromPng(opaquePng(32, 16), {
      tileSize: 8
    });

    assert.deepEqual(file.pixels.size, { x: 32, y: 16 });
    assert.equal(file.blocks.length, 8);
    assert.deepEqual(
      file.blocks.map(({ id, defaultTexture }) => [
        id,
        defaultTexture?.col,
        defaultTexture?.row
      ]).slice(3, 6),
      [[4, 3, 0], [5, 0, 1], [6, 1, 1]]
    );
  });

  test("caps the generated blocks", async() => {
    const file = await blocksetFileFromPng(opaquePng(32, 16), {
      tileSize: 8,
      blockLimit: 3
    });

    assert.deepEqual(file.blocks.map(({ id }) => id), [1, 2, 3]);
  });
});

describe("blockset file codec", () => {
  test("round-trips through bytes", async() => {
    const file = await blocksetFileFromPng(opaquePng(16, 16), {
      tileSize: 8
    });

    assert.deepEqual(
      decodeBlocksetFile(encodeBlocksetFile(file)),
      file
    );
  });

  test("rejects a file that is not JSON", () => {
    assert.throws(
      () => decodeBlocksetFile(new TextEncoder().encode("{")),
      InvalidAssetFileError
    );
  });

  test("rejects an unsupported version, tile size, pixels or blocks", () => {
    const valid = createBlocksetFile({ tileSize: 8, size: { x: 8, y: 8 } });

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
        () => parseBlocksetFile(broken),
        InvalidAssetFileError,
        name
      );
    }
    assert.deepEqual(parseBlocksetFile(valid), valid);
  });
});
