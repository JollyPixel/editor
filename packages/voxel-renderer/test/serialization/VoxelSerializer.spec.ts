// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelSerializer } from "../../src/serialization/VoxelSerializer.ts";
import { VoxelWorld } from "../../src/world/VoxelWorld.ts";

function makeEntry(blockId = 1, transform = 0) {
  return { blockId, transform };
}

// Minimal TilesetManager stub — serialize() only calls getDefinitions()
const emptyTilesetManager = {
  getDefinitions() {
    return [];
  }
} as any;

const tilesetManagerWithOne = {
  getDefinitions() {
    return [{ id: "atlas", src: "/atlas.png", tileSize: 16, cols: 4, rows: 4 }];
  }
} as any;

describe("VoxelSerializer.serialize", () => {
  it("empty world serializes to version=1 with empty layers", () => {
    const world = new VoxelWorld(16);
    const serializer = new VoxelSerializer();
    const json = serializer.serialize(world, emptyTilesetManager);

    assert.equal(json.version, 1);
    assert.equal(json.chunkSize, 16);
    assert.deepEqual(json.layers, []);
    assert.deepEqual(json.tilesets, []);
  });

  it("includes tilesets from the manager", () => {
    const world = new VoxelWorld(16);
    const serializer = new VoxelSerializer();
    const json = serializer.serialize(world, tilesetManagerWithOne);

    assert.equal(json.tilesets.length, 1);
    assert.equal(json.tilesets[0].id, "atlas");
  });

  it("serializes a single voxel correctly", () => {
    const world = new VoxelWorld(16);
    const layer = world.addLayer("Ground");
    layer.setVoxelAt({ x: 3, y: 2, z: 1 }, makeEntry(5, 3));

    const serializer = new VoxelSerializer();
    const json = serializer.serialize(world, emptyTilesetManager);

    assert.equal(json.layers.length, 1);
    const layerJson = json.layers[0];
    assert.equal(layerJson.name, "Ground");
    assert.equal(layerJson.voxels["3,2,1"]?.block, 5);
    assert.equal(layerJson.voxels["3,2,1"]?.transform, 3);
  });

  it("offset is included in layer JSON", () => {
    const world = new VoxelWorld(16);
    const layer = world.addLayer("Ground");
    layer.offset = { x: 16, y: 0, z: -8 };

    const serializer = new VoxelSerializer();
    const json = serializer.serialize(world, emptyTilesetManager);

    assert.deepEqual(json.layers[0].offset, { x: 16, y: 0, z: -8 });
  });

  it("world-space key includes offset", () => {
    // A voxel at layer-local position (0,0,0) with offset {x:16} should appear at key "16,0,0"
    const world = new VoxelWorld(16);
    const layer = world.addLayer("Ground");
    layer.offset = { x: 16, y: 0, z: 0 };
    layer.setVoxelAt({ x: 16, y: 0, z: 0 }, makeEntry(1));

    const serializer = new VoxelSerializer();
    const json = serializer.serialize(world, emptyTilesetManager);

    assert.ok("16,0,0" in json.layers[0].voxels, "expected key 16,0,0");
  });
});

describe("VoxelSerializer.deserialize", () => {
  it("throws when version is not 1", () => {
    const world = new VoxelWorld(16);
    const serializer = new VoxelSerializer();

    assert.throws(
      () => serializer.deserialize({ version: 2 } as any, world),
      /unsupported version/
    );
  });

  it("clears the world before restoring", () => {
    const world = new VoxelWorld(16);
    world.addLayer("Existing");
    const serializer = new VoxelSerializer();

    serializer.deserialize(
      { version: 1, chunkSize: 16, tilesets: [], layers: [] },
      world
    );

    assert.equal(world.getLayers().length, 0);
  });

  it("skips malformed coordinate keys", () => {
    const world = new VoxelWorld(16);
    const serializer = new VoxelSerializer();

    assert.doesNotThrow(() => serializer.deserialize(
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
});

describe("VoxelSerializer round-trip", () => {
  it("single layer with multiple voxels", () => {
    const original = new VoxelWorld(16);
    const layer = original.addLayer("Ground");
    layer.setVoxelAt({ x: 0, y: 0, z: 0 }, makeEntry(1, 0));
    layer.setVoxelAt({ x: 5, y: 3, z: 2 }, makeEntry(2, 1));
    layer.setVoxelAt({ x: -1, y: 0, z: -1 }, makeEntry(3, 2));

    const serializer = new VoxelSerializer();
    const json = serializer.serialize(original, emptyTilesetManager);

    const restored = new VoxelWorld(16);
    serializer.deserialize(json, restored);

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

    const serializer = new VoxelSerializer();
    const json = serializer.serialize(original, emptyTilesetManager);

    const restored = new VoxelWorld(16);
    serializer.deserialize(json, restored);

    const restoredBase = restored.getLayer("Base");
    const restoredDeco = restored.getLayer("Deco");

    assert.ok(restoredBase !== undefined);
    assert.ok(restoredDeco !== undefined);
    assert.equal(restoredBase.order, base.order);
    assert.equal(restoredDeco.visible, false);
  });

  it("layer offset is preserved", () => {
    const original = new VoxelWorld(16);
    const layer = original.addLayer("Ground");
    layer.offset = { x: 32, y: 0, z: -16 };
    layer.setVoxelAt({ x: 32, y: 0, z: 0 }, makeEntry(1));

    const serializer = new VoxelSerializer();
    const json = serializer.serialize(original, emptyTilesetManager);

    const restored = new VoxelWorld(16);
    serializer.deserialize(json, restored);

    assert.deepEqual(restored.getLayer("Ground")?.offset, { x: 32, y: 0, z: -16 });
    assert.ok(restored.getVoxelAt({ x: 32, y: 0, z: 0 }) !== undefined);
  });

  it("serialized layer id is restored verbatim", () => {
    const original = new VoxelWorld(16);
    const layer = original.addLayer("Ground");
    const originalId = layer.id;

    const serializer = new VoxelSerializer();
    const json = serializer.serialize(original, emptyTilesetManager);

    const restored = new VoxelWorld(16);
    serializer.deserialize(json, restored);

    assert.equal(restored.getLayer("Ground")?.id, originalId);
  });
});
