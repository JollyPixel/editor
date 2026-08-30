// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { blocksFromTileset } from "../../src/blocks/blocksFromTileset.ts";
import type { ResolvedTilesetDefinition } from "../../src/tileset/types.ts";

// CONSTANTS
const kTerrain: ResolvedTilesetDefinition = {
  id: "terrain",
  src: "/assets/terrain.png",
  tileSize: 16,
  cols: 4,
  rows: 2
};

describe("blocksFromTileset", () => {
  it("emits one block per tile, numbered from 1 in row-major order", () => {
    const blocks = Array.from(
      blocksFromTileset(kTerrain)
    );

    assert.equal(blocks.length, 8);
    assert.equal(blocks[0].id, 1);
    assert.deepEqual(blocks[0].defaultTexture, {
      tilesetId: "terrain",
      col: 0,
      row: 0
    });
    assert.deepEqual(blocks.at(-1)!.defaultTexture, {
      tilesetId: "terrain",
      col: 3,
      row: 1
    });
  });

  it("stops at the requested limit", () => {
    const blocks = Array.from(
      blocksFromTileset(kTerrain, { limit: 3 })
    );
    assert.equal(
      blocks.length,
      3
    );
  });

  it("applies overrides on top of the generated definition", () => {
    const [block] = blocksFromTileset(kTerrain, {
      limit: 1,
      map: (blockId) => {
        return {
          name: `Tile ${blockId}`,
          collidable: true
        };
      }
    });

    assert.equal(block.name, "Tile 1");
    assert.equal(block.collidable, true);
    assert.deepEqual(block.defaultTexture, {
      tilesetId: "terrain",
      col: 0,
      row: 0
    });
  });
});
