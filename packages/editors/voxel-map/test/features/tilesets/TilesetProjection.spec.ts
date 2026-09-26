// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  composeBlockId,
  TilesetDocument,
  VoxelDocument
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  TilesetProjection,
  type ProjectionEngine
} from "../../../src/features/tilesets/TilesetProjection.ts";

function makeEngine(): ProjectionEngine {
  const document = new VoxelDocument();

  return {
    blockRegistry: document.blocks,
    materialGroups: document.materialGroups,
    defineBlock: (def) => document.defineBlock(def),
    defineBlocks: (defs) => document.defineBlocks(defs),
    removeBlock: (id) => document.removeBlock(id),
    moveBlock: (id, toIndex) => document.moveBlock(id, toIndex),
    defineMaterialGroup: (group) => document.defineMaterialGroup(group),
    removeMaterialGroup: (id) => document.removeMaterialGroup(id)
  };
}

function makeTileset(): TilesetDocument {
  return new TilesetDocument({
    tileSize: 16,
    blocks: [
      {
        id: 1,
        name: "grass",
        shapeId: "cube",
        materialGroup: "soft",
        defaultTexture: { col: 0, row: 0 }
      },
      {
        id: 2,
        name: "stone",
        shapeId: "cube",
        defaultTexture: { col: 1, row: 0 }
      }
    ],
    materialGroups: [{ id: "soft", roughness: 0.5 }]
  });
}

function ids(
  engine: ProjectionEngine
): number[] {
  return [...engine.blockRegistry].map((block) => block.id);
}

describe("TilesetProjection", () => {
  it("projects the tileset blocks and groups under its slot", () => {
    const engine = makeEngine();
    const tileset = makeTileset();
    new TilesetProjection({
      engine,
      tileset,
      slot: { id: "terrain", slot: 2 }
    });

    const grass = engine.blockRegistry.get(composeBlockId(2, 1));
    assert.deepEqual(ids(engine), [composeBlockId(2, 1), composeBlockId(2, 2)]);
    assert.deepEqual(grass?.defaultTexture, {
      col: 0,
      row: 0,
      tilesetId: "terrain"
    });
    assert.equal(grass?.materialGroup, "terrain/soft");
    assert.equal(engine.materialGroups.get("terrain/soft")?.roughness, 0.5);
  });

  it("mirrors block and group commands as the tileset changes", () => {
    const engine = makeEngine();
    const tileset = makeTileset();
    new TilesetProjection({
      engine,
      tileset,
      slot: { id: "terrain", slot: 1 }
    });

    tileset.defineBlock({
      id: 3,
      name: "sand",
      shapeId: "cube",
      defaultTexture: { col: 2, row: 0 }
    });
    tileset.removeBlock(1);
    tileset.moveBlock(3, 0);
    tileset.defineMaterialGroup({ id: "hard", metalness: 1 });
    tileset.removeMaterialGroup("soft");

    assert.deepEqual(ids(engine), [composeBlockId(1, 3), composeBlockId(1, 2)]);
    assert.equal(engine.materialGroups.has("terrain/soft"), false);
    assert.equal(engine.materialGroups.get("terrain/hard")?.metalness, 1);
  });

  it("re-projects rescaled tiles after a tile size change", () => {
    const engine = makeEngine();
    const tileset = makeTileset();
    new TilesetProjection({
      engine,
      tileset,
      slot: { id: "terrain", slot: 0 }
    });

    tileset.resizeTiles(32);

    assert.deepEqual(engine.blockRegistry.get(2)?.defaultTexture, {
      col: 0.5,
      row: 0,
      size: 16,
      tilesetId: "terrain"
    });
  });

  it("leaves the blocks of other slots alone and unprojects on dispose", () => {
    const engine = makeEngine();
    engine.defineBlock({
      id: composeBlockId(3, 1),
      name: "other",
      shapeId: "cube"
    });
    engine.defineMaterialGroup({ id: "other/soft" });
    const projection = new TilesetProjection({
      engine,
      tileset: makeTileset(),
      slot: { id: "terrain", slot: 1 }
    });

    projection.dispose();

    assert.deepEqual(ids(engine), [composeBlockId(3, 1)]);
    assert.deepEqual([...engine.materialGroups.ids()], ["other/soft"]);
  });

  it("re-homes its blocks when the slot changes", () => {
    const engine = makeEngine();
    const projection = new TilesetProjection({
      engine,
      tileset: makeTileset(),
      slot: { id: "terrain", slot: 1 }
    });

    projection.update({ id: "terrain", slot: 4 });

    assert.deepEqual(ids(engine), [composeBlockId(4, 1), composeBlockId(4, 2)]);
  });
});
