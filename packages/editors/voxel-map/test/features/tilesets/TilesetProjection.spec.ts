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
  return new VoxelDocument();
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
        blendGroup: "meadow",
        defaultTexture: { col: 0, row: 0 }
      },
      {
        id: 2,
        name: "stone",
        shapeId: "cube",
        defaultTexture: { col: 1, row: 0 }
      }
    ],
    materialGroups: [{ id: "soft", roughness: 0.5 }],
    blendGroups: [{ id: "meadow", exclude: ["rock"] }]
  });
}

function ids(
  engine: ProjectionEngine
): number[] {
  return [...engine.blocks].map((block) => block.id);
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

    const grass = engine.blocks.get(composeBlockId(2, 1));
    assert.deepEqual(ids(engine), [composeBlockId(2, 1), composeBlockId(2, 2)]);
    assert.deepEqual(grass?.defaultTexture, {
      col: 0,
      row: 0,
      tilesetId: "terrain"
    });
    assert.equal(grass?.materialGroup, "terrain/soft");
    assert.equal(engine.materialGroups.get("terrain/soft")?.roughness, 0.5);
    assert.equal(grass?.blendGroup, "terrain/meadow");
    assert.deepEqual(
      engine.blendGroups.get("terrain/meadow")?.exclude,
      ["terrain/rock"]
    );
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
    tileset.defineBlendGroup({ id: "beach", width: 6 });
    tileset.removeBlendGroup("meadow");

    assert.deepEqual(ids(engine), [composeBlockId(1, 3), composeBlockId(1, 2)]);
    assert.equal(engine.materialGroups.has("terrain/soft"), false);
    assert.equal(engine.materialGroups.get("terrain/hard")?.metalness, 1);
    assert.equal(engine.blendGroups.has("terrain/meadow"), false);
    assert.equal(engine.blendGroups.get("terrain/beach")?.width, 6);
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

    assert.deepEqual(engine.blocks.get(2)?.defaultTexture, {
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
    engine.defineBlendGroup({ id: "other/meadow" });
    const projection = new TilesetProjection({
      engine,
      tileset: makeTileset(),
      slot: { id: "terrain", slot: 1 }
    });

    projection.dispose();

    assert.deepEqual(ids(engine), [composeBlockId(3, 1)]);
    assert.deepEqual([...engine.materialGroups.ids()], ["other/soft"]);
    assert.deepEqual([...engine.blendGroups].map(({ id }) => id), ["other/meadow"]);
  });
});
