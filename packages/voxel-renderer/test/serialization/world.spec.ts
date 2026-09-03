// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  deserializeVoxelWorld,
  serializeVoxelWorld
} from "../../src/serialization/world.ts";
import { VoxelWorld } from "../../src/world/VoxelWorld.ts";
import { BlockRegistry } from "../../src/blocks/BlockRegistry.ts";
import {
  resolveBlockDefinition
} from "../../src/blocks/BlockDefinition.ts";
import type { TilesetDefinition } from "../../src/tileset/types.ts";
import { makeVoxelEntry } from "../helpers/voxelEntry.ts";
import { makeBlockDef } from "../helpers/blocks.ts";

// CONSTANTS
const kAtlas: TilesetDefinition = {
  id: "atlas",
  src: "/atlas.png",
  tileSize: 16,
  cols: 4,
  rows: 4
};

describe("serializeVoxelWorld", () => {
  it("empty world serializes to version=1 with empty layers", () => {
    const world = new VoxelWorld(16);
    const json = serializeVoxelWorld(world);

    assert.equal(json.version, 1);
    assert.equal(json.chunkSize, 16);
    assert.deepEqual(json.layers, []);
    assert.deepEqual(json.tilesets, []);
  });

  it("includes the tilesets passed as metadata", () => {
    const world = new VoxelWorld(16);
    const json = serializeVoxelWorld(world, { tilesets: [kAtlas] });

    assert.equal(json.tilesets.length, 1);
    assert.equal(json.tilesets[0].id, "atlas");
  });

  it("omits blocks when none are provided", () => {
    const world = new VoxelWorld(16);

    assert.equal(serializeVoxelWorld(world).blocks, undefined);
  });

  it("embeds the blocks passed as metadata", () => {
    const world = new VoxelWorld(16);
    const registry = new BlockRegistry([makeBlockDef(4, "cube")]);
    const json = serializeVoxelWorld(world, { blocks: registry });

    assert.deepEqual(
      json.blocks?.map((block) => block.id),
      [4]
    );
  });

  it("serializes a single voxel correctly", () => {
    const world = new VoxelWorld(16);
    const layer = world.addLayer("Ground");
    layer.setVoxelAt({ x: 3, y: 2, z: 1 }, makeVoxelEntry(5, 3));

    const json = serializeVoxelWorld(world);

    assert.equal(json.layers.length, 1);
    const layerJson = json.layers[0];
    assert.equal(layerJson.name, "Ground");
    assert.equal(layerJson.voxels["3,2,1"]?.block, 5);
    assert.equal(layerJson.voxels["3,2,1"]?.transform, 3);
  });

  it("opacity is included in layer JSON", () => {
    const world = new VoxelWorld(16);
    const layer = world.addLayer("Ground", { opacity: 0.4 });

    const json = serializeVoxelWorld(world);

    assert.equal(json.layers[0].opacity, layer.opacity);
    assert.equal(json.layers[0].opacity, 0.4);
  });

  it("offset is included in layer JSON", () => {
    const world = new VoxelWorld(16);
    const layer = world.addLayer("Ground");
    layer.offset = { x: 16, y: 0, z: -8 };

    const json = serializeVoxelWorld(world);

    assert.deepEqual(json.layers[0].offset, { x: 16, y: 0, z: -8 });
  });

  it("world-space key includes offset", () => {
    // A voxel at layer-local position (0,0,0) with offset {x:16} should appear at key "16,0,0"
    const world = new VoxelWorld(16);
    const layer = world.addLayer("Ground");
    layer.offset = { x: 16, y: 0, z: 0 };
    layer.setVoxelAt({ x: 16, y: 0, z: 0 }, makeVoxelEntry(1));

    const json = serializeVoxelWorld(world);

    assert.ok("16,0,0" in json.layers[0].voxels, "expected key 16,0,0");
  });
});

describe("deserializeVoxelWorld", () => {
  it("throws when version is not 1", () => {
    const world = new VoxelWorld(16);

    assert.throws(
      () => deserializeVoxelWorld({ version: 2 } as any, world),
      /unsupported version/
    );
  });

  it("clears the world before restoring", () => {
    const world = new VoxelWorld(16);
    world.addLayer("Existing");
    deserializeVoxelWorld(
      { version: 1, chunkSize: 16, tilesets: [], layers: [] },
      world
    );

    assert.equal(world.getLayers().length, 0);
  });

  it("defaults opacity to 1 when the field is absent (pre-opacity save file)", () => {
    const world = new VoxelWorld(16);
    deserializeVoxelWorld(
      {
        version: 1,
        chunkSize: 16,
        tilesets: [],
        layers: [{
          id: "l1",
          name: "Ground",
          visible: true,
          order: 0,
          voxels: {}
        }]
      },
      world
    );

    const layer = world.getLayer("Ground");
    assert.ok(layer !== undefined);
    assert.equal(layer.opacity, 1);
  });

  it("restores an explicit opacity value", () => {
    const world = new VoxelWorld(16);
    deserializeVoxelWorld(
      {
        version: 1,
        chunkSize: 16,
        tilesets: [],
        layers: [{
          id: "l1",
          name: "Ground",
          visible: true,
          opacity: 0.6,
          order: 0,
          voxels: {}
        }]
      },
      world
    );

    const layer = world.getLayer("Ground");
    assert.ok(layer !== undefined);
    assert.equal(layer.opacity, 0.6);
  });

  it("skips malformed coordinate keys", () => {
    const world = new VoxelWorld(16);

    assert.doesNotThrow(() => deserializeVoxelWorld(
      {
        version: 1,
        chunkSize: 16,
        tilesets: [],
        layers: [{
          id: "l1",
          name: "Ground",
          visible: true,
          order: 0,
          voxels: {
            // @ts-expect-error
            "not,a,number": { block: 1, transform: 0 },
            "0,0,0": { block: 2, transform: 0 }
          }
        }]
      },
      world
    )
    );

    // Only the valid key "0,0,0" should be present
    assert.ok(world.getVoxelAt({ x: 0, y: 0, z: 0 }) !== undefined);
  });

  it("throws when layers is not an array", () => {
    const world = new VoxelWorld(16);

    assert.throws(
      () => deserializeVoxelWorld(
        { version: 1, chunkSize: 16, tilesets: [] } as any,
        world
      ),
      /layers is not an array/
    );
  });

  it("throws when the chunk size differs from the world", () => {
    const world = new VoxelWorld(16);

    assert.throws(
      () => deserializeVoxelWorld(
        { version: 1, chunkSize: 8, tilesets: [], layers: [] },
        world
      ),
      /chunkSize 8 does not match the world's 16/
    );
  });

  it("leaves the world untouched when the document is invalid", () => {
    const world = new VoxelWorld(16);
    world.addLayer("Existing");
    assert.throws(
      () => deserializeVoxelWorld({ version: 2 } as any, world)
    );
    assert.equal(world.getLayers().length, 1);
  });

  it("registers embedded blocks into the provided registry", () => {
    const world = new VoxelWorld(16);
    const registry = new BlockRegistry();
    deserializeVoxelWorld(
      {
        version: 1,
        chunkSize: 16,
        tilesets: [],
        blocks: [resolveBlockDefinition(makeBlockDef(7, "cube"))],
        layers: []
      },
      world,
      { blocks: registry }
    );

    assert.equal(registry.has(7), true);
  });

  it("overwrites an existing registration with the embedded definition", () => {
    const world = new VoxelWorld(16);
    const registry = new BlockRegistry([
      makeBlockDef(7, "cube", { name: "local" })
    ]);
    deserializeVoxelWorld(
      {
        version: 1,
        chunkSize: 16,
        tilesets: [],
        blocks: [
          resolveBlockDefinition(
            makeBlockDef(7, "cube", { name: "embedded" })
          )
        ],
        layers: []
      },
      world,
      { blocks: registry }
    );

    assert.equal(registry.get(7)?.name, "embedded");
  });

  it("drops registrations the embedded block table does not name", () => {
    const world = new VoxelWorld(16);
    const registry = new BlockRegistry([makeBlockDef(9, "cube")]);
    deserializeVoxelWorld(
      {
        version: 1,
        chunkSize: 16,
        tilesets: [],
        blocks: [resolveBlockDefinition(makeBlockDef(7, "cube"))],
        layers: []
      },
      world,
      { blocks: registry }
    );

    assert.equal(registry.has(9), false);
    assert.equal(registry.has(7), true);
  });

  it("keeps the registry untouched for a document carrying no block table", () => {
    const world = new VoxelWorld(16);
    const registry = new BlockRegistry([makeBlockDef(9, "cube")]);
    deserializeVoxelWorld(
      {
        version: 1,
        chunkSize: 16,
        tilesets: [],
        layers: []
      },
      world,
      { blocks: registry }
    );

    assert.equal(registry.has(9), true);
  });

  it("leaves the registry alone when the document is rejected", () => {
    const world = new VoxelWorld(16);
    const registry = new BlockRegistry([makeBlockDef(9, "cube")]);

    assert.throws(() => deserializeVoxelWorld(
      {
        version: 1,
        chunkSize: 8,
        tilesets: [],
        blocks: [resolveBlockDefinition(makeBlockDef(7, "cube"))],
        layers: []
      },
      world,
      { blocks: registry }
    ));

    assert.equal(registry.has(9), true);
    assert.equal(registry.has(7), false);
  });
});

describe("voxel world round-trip", () => {
  it("single layer with multiple voxels", () => {
    const original = new VoxelWorld(16);
    const layer = original.addLayer("Ground");
    layer.setVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry(1, 0));
    layer.setVoxelAt({ x: 5, y: 3, z: 2 }, makeVoxelEntry(2, 1));
    layer.setVoxelAt({ x: -1, y: 0, z: -1 }, makeVoxelEntry(3, 2));

    const json = serializeVoxelWorld(original);

    const restored = new VoxelWorld(16);
    deserializeVoxelWorld(json, restored);

    const e1 = restored.getVoxelAt({ x: 0, y: 0, z: 0 });
    const e2 = restored.getVoxelAt({ x: 5, y: 3, z: 2 });
    const e3 = restored.getVoxelAt({ x: -1, y: 0, z: -1 });

    assert.ok(e1 !== undefined, "expected voxel at 0,0,0");
    assert.equal(e1.blockId, 1);
    assert.equal(e1.transform, 0);

    assert.ok(e2 !== undefined, "expected voxel at 5,3,2");
    assert.equal(e2.blockId, 2);
    assert.equal(e2.transform, 1);

    assert.ok(e3 !== undefined, "expected voxel at -1,0,-1");
    assert.equal(e3.blockId, 3);
    assert.equal(e3.transform, 2);
  });

  it("multiple layers preserve name, visibility, and order", () => {
    const original = new VoxelWorld(16);
    const base = original.addLayer("Base");
    const deco = original.addLayer("Deco");
    deco.visible = false;

    const json = serializeVoxelWorld(original);

    const restored = new VoxelWorld(16);
    deserializeVoxelWorld(json, restored);

    const restoredBase = restored.getLayer("Base");
    const restoredDeco = restored.getLayer("Deco");

    assert.ok(restoredBase !== undefined);
    assert.ok(restoredDeco !== undefined);
    assert.equal(restoredBase.order, base.order);
    assert.equal(restoredDeco.visible, false);
  });

  it("layer opacity is preserved", () => {
    const original = new VoxelWorld(16);
    original.addLayer("Ground", { opacity: 0.7 });

    const json = serializeVoxelWorld(original);

    const restored = new VoxelWorld(16);
    deserializeVoxelWorld(json, restored);

    assert.equal(restored.getLayer("Ground")?.opacity, 0.7);
  });

  it("layer offset is preserved", () => {
    const original = new VoxelWorld(16);
    const layer = original.addLayer("Ground");
    layer.offset = { x: 32, y: 0, z: -16 };
    layer.setVoxelAt({ x: 32, y: 0, z: 0 }, makeVoxelEntry(1));

    const json = serializeVoxelWorld(original);

    const restored = new VoxelWorld(16);
    deserializeVoxelWorld(json, restored);

    assert.deepEqual(restored.getLayer("Ground")?.offset, { x: 32, y: 0, z: -16 });
    assert.ok(restored.getVoxelAt({ x: 32, y: 0, z: 0 }) !== undefined);
  });

  it("serialized layer id is restored verbatim", () => {
    const original = new VoxelWorld(16);
    const layer = original.addLayer("Ground");
    const originalId = layer.id;

    const json = serializeVoxelWorld(original);

    const restored = new VoxelWorld(16);
    deserializeVoxelWorld(json, restored);

    assert.equal(restored.getLayer("Ground")?.id, originalId);
  });
});
