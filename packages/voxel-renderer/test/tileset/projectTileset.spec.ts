// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  belongsToTileset,
  localMaterialGroupId,
  localTilesetBlock,
  projectedMaterialGroupId,
  projectTilesetBlock,
  projectTilesetBlocks,
  projectTilesetMaterialGroups,
  type TilesetProjection
} from "../../src/tileset/index.ts";
import {
  composeBlockId,
  resolveBlockDefinition
} from "../../src/blocks/index.ts";
import { makeBlockDef } from "../helpers/blocks.ts";

// CONSTANTS
const kStone: TilesetProjection = {
  id: "stone",
  slot: 3
};
const kLocalBlock = resolveBlockDefinition(makeBlockDef(5, "cube", {
  faceTextures: { top: { col: 1, row: 1 } },
  defaultTexture: { col: 2, row: 0 },
  materialGroup: "gold"
}));

describe("projectTilesetBlock", () => {
  it("gives the block its world id, tileset and material group", () => {
    const projected = projectTilesetBlock(kStone, kLocalBlock);

    assert.equal(projected.id, composeBlockId(3, 5));
    assert.deepEqual(projected.defaultTexture, {
      tilesetId: "stone",
      col: 2,
      row: 0
    });
    assert.deepEqual(projected.faceTextures, {
      top: { tilesetId: "stone", col: 1, row: 1 }
    });
    assert.equal(projected.materialGroup, "stone/gold");
  });

  it("leaves a block without material group untouched on that field", () => {
    const projected = projectTilesetBlock(
      kStone,
      resolveBlockDefinition(makeBlockDef(1, "cube"))
    );

    assert.equal("materialGroup" in projected, false);
  });

  it("projects every block of a tileset", () => {
    const blocks = projectTilesetBlocks(kStone, [
      resolveBlockDefinition(makeBlockDef(1, "cube")),
      resolveBlockDefinition(makeBlockDef(2, "cube"))
    ]);

    assert.deepEqual(
      blocks.map(({ id }) => id),
      [composeBlockId(3, 1), composeBlockId(3, 2)]
    );
  });
});

describe("localTilesetBlock", () => {
  it("inverts the projection", () => {
    const projected = projectTilesetBlock(kStone, kLocalBlock);

    assert.deepEqual(localTilesetBlock(kStone, projected), kLocalBlock);
  });
});

describe("material group ids", () => {
  it("prefixes the group with the tileset id and strips it back", () => {
    const projected = projectedMaterialGroupId(kStone, "gold");

    assert.equal(projected, "stone/gold");
    assert.equal(localMaterialGroupId(kStone, projected), "gold");
    assert.equal(localMaterialGroupId(kStone, "other/gold"), "other/gold");
  });

  it("projects every group of a tileset", () => {
    assert.deepEqual(
      projectTilesetMaterialGroups(kStone, [{ id: "gold", metalness: 1 }]),
      [{ id: "stone/gold", metalness: 1 }]
    );
  });
});

describe("belongsToTileset", () => {
  it("recognizes ids projected into the tileset slot", () => {
    assert.equal(belongsToTileset(kStone, composeBlockId(3, 9)), true);
    assert.equal(belongsToTileset(kStone, composeBlockId(2, 9)), false);
    assert.equal(belongsToTileset({ slot: 0 }, 9), true);
  });
});
