// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  applyTilesetCommand,
  type TilesetDocument
} from "../src/applyTilesetCommand.ts";
import { TilesetList } from "../src/tileset/index.ts";
import { BlockRegistry } from "../src/blocks/index.ts";

function makeDocument(): TilesetDocument {
  return {
    tilesets: new TilesetList([
      { id: "a", src: "a", tileSize: 16 },
      { id: "b", src: "b", tileSize: 16 }
    ]),
    blocks: new BlockRegistry([
      {
        id: 1,
        name: "one",
        shapeId: "cube",
        defaultTexture: { tilesetId: "a", col: 2, row: 2 }
      },
      {
        id: 2,
        name: "two",
        shapeId: "cube",
        defaultTexture: { tilesetId: "b", col: 2, row: 2 }
      }
    ])
  };
}

describe("applyTilesetCommand", () => {
  it("adds and removes tilesets", () => {
    const document = makeDocument();

    assert.equal(applyTilesetCommand(document, {
      action: "tileset-added",
      tileset: { id: "c", src: "c", tileSize: 8 }
    }), true);
    assert.equal(applyTilesetCommand(document, {
      action: "tileset-removed",
      tilesetId: "a"
    }), true);
    assert.deepEqual([...document.tilesets.ids()], ["b", "c"]);
  });

  it("rescales only the blocks of a resized tileset", () => {
    const document = makeDocument();

    assert.equal(applyTilesetCommand(document, {
      action: "tileset-resized",
      tilesetId: "a",
      tileSize: 32
    }), true);

    assert.deepEqual(document.blocks.get(1)?.defaultTexture, {
      tilesetId: "a",
      col: 1,
      row: 1,
      size: 16
    });
    assert.deepEqual(document.blocks.get(2)?.defaultTexture, {
      tilesetId: "b",
      col: 2,
      row: 2
    });
  });

  it("rejects an invalid resize", () => {
    const document = makeDocument();

    assert.equal(applyTilesetCommand(document, {
      action: "tileset-resized",
      tilesetId: "missing",
      tileSize: 32
    }), false);
    assert.equal(applyTilesetCommand(document, {
      action: "tileset-resized",
      tilesetId: "a",
      tileSize: 0
    }), false);
  });

  it("updates the default tile size", () => {
    const document = makeDocument();

    assert.equal(applyTilesetCommand(document, {
      action: "default-tile-size-updated",
      defaultTileSize: 64
    }), true);
    assert.equal(document.tilesets.defaultTileSize, 64);
  });
});
