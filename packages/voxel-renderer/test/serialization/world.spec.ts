// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  deserializeVoxelWorld,
  serializeTilesetDefinition,
  serializeVoxelWorld,
  VOXEL_WORLD_VERSION,
  type VoxelWorldJSON
} from "../../src/serialization/index.ts";
import { VoxelWorld } from "../../src/world/index.ts";
import {
  TilesetList,
  type TilesetDefinition
} from "../../src/tileset/index.ts";
import { makeVoxelEntry } from "../helpers/voxelEntry.ts";

// CONSTANTS
const kAtlas: TilesetDefinition = {
  id: "atlas",
  src: "/atlas.png",
  tileSize: 16,
  cols: 4,
  rows: 4
};

function untrusted(
  document: object
): VoxelWorldJSON {
  return JSON.parse(JSON.stringify(document));
}

function emptyDocument(
  fields: Partial<VoxelWorldJSON> = {}
): VoxelWorldJSON {
  return {
    version: VOXEL_WORLD_VERSION,
    chunkSize: 16,
    tilesets: [],
    layers: [],
    ...fields
  };
}

function makeRichWorld(): VoxelWorld {
  const world = new VoxelWorld(16);
  const ground = world.addLayer("Ground", {
    opacity: 0.7,
    properties: { biome: "forest" }
  });
  ground.position = { x: 32, y: 0, z: -16 };
  ground.setVoxelAt({ x: 32, y: 0, z: 0 }, makeVoxelEntry(1, 0));
  ground.setVoxelAt({ x: 37, y: 3, z: 2 }, makeVoxelEntry(2, 1));
  ground.setVoxelAt({ x: 31, y: 0, z: -17 }, makeVoxelEntry(3, 2));
  const glass = world.addLayer("Glass", { compositing: "replace" });
  glass.visible = false;
  glass.setVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry(4, 0));
  world.objectLayers.add("Spawns");

  return world;
}

describe("voxel world round-trip", () => {
  it("restores every layer, id and voxel of a saved world", () => {
    const original = makeRichWorld();
    const json = serializeVoxelWorld(original);

    const restored = new VoxelWorld(16);
    deserializeVoxelWorld(untrusted(json), restored);

    assert.deepEqual(serializeVoxelWorld(restored), json);
    assert.deepEqual(restored.getVoxelAt({ x: 37, y: 3, z: 2 }), makeVoxelEntry(2, 1));
    assert.equal(restored.getLayer("Glass")?.compositing, "replace");
  });

  it("restores the tileset links with their slots", () => {
    const tilesets = new TilesetList([
      { id: "ground", slot: 3, asset: { id: "a1", kind: "tileset" } },
      kAtlas
    ]);
    const json = serializeVoxelWorld(new VoxelWorld(16), { tilesets });

    const restored = new TilesetList();
    deserializeVoxelWorld(untrusted(json), new VoxelWorld(16), {
      tilesets: restored
    });

    assert.deepEqual(
      restored.definitions().map(({ id, slot }) => [id, slot]),
      [["ground", 3], ["atlas", 0]]
    );
    assert.equal(restored.get("ground")?.tileSize, undefined);
    assert.equal(restored.get("atlas")?.tileSize, 16);
  });
});

describe("serializeTilesetDefinition", () => {
  it("keeps only the link of an asset tileset", () => {
    assert.deepEqual(
      serializeTilesetDefinition({
        id: "ground",
        slot: 2,
        asset: { id: "a1", kind: "tileset" },
        tileSize: 32,
        cols: 8,
        rows: 8
      }),
      {
        id: "ground",
        slot: 2,
        asset: { id: "a1", kind: "tileset" }
      }
    );
  });

  it("keeps the tile size and grid of a URL tileset", () => {
    assert.deepEqual(serializeTilesetDefinition(kAtlas), kAtlas);
  });
});

describe("serializeVoxelWorld", () => {
  it("empty world serializes to the current version with empty layers", () => {
    const world = new VoxelWorld(16);
    const json = serializeVoxelWorld(world);

    assert.equal(json.version, VOXEL_WORLD_VERSION);
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

  it("writes no block or material group table", () => {
    const json = serializeVoxelWorld(new VoxelWorld(16));

    assert.deepEqual(
      Object.keys(json).sort(),
      ["chunkSize", "layers", "objectLayers", "tilesets", "version"]
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

  it("stores voxel keys in layer-local space", () => {
    const world = new VoxelWorld(16);
    const layer = world.addLayer("Ground");
    layer.position = { x: 16, y: 0, z: 0 };
    layer.setVoxelAt({ x: 16, y: 0, z: 0 }, makeVoxelEntry(1));

    const json = serializeVoxelWorld(world);

    assert.ok("0,0,0" in json.layers[0].voxels);
    assert.equal(json.layers[0].voxels["16,0,0"], undefined);
  });
});

describe("deserializeVoxelWorld", () => {
  it("rejects version 1 documents", () => {
    const world = new VoxelWorld(16);

    assert.throws(
      () => deserializeVoxelWorld(
        untrusted({ version: 1, chunkSize: 16, tilesets: [], layers: [] }),
        world
      ),
      /unsupported version/
    );
  });

  it("clears the world before restoring", () => {
    const world = new VoxelWorld(16);
    world.addLayer("Existing");
    deserializeVoxelWorld(emptyDocument(), world);

    assert.equal(world.getLayers().length, 0);
  });

  it("replaces the tileset links, clearing them when none are saved", () => {
    const tilesets = new TilesetList([kAtlas]);

    deserializeVoxelWorld(
      emptyDocument({
        tilesets: [{ id: "ground", asset: { id: "a1", kind: "tileset" } }]
      }),
      new VoxelWorld(16),
      { tilesets }
    );
    assert.deepEqual([...tilesets.ids()], ["ground"]);

    deserializeVoxelWorld(emptyDocument(), new VoxelWorld(16), { tilesets });
    assert.equal(tilesets.size, 0);
  });

  it("defaults opacity and compositing for an older save file", () => {
    const world = new VoxelWorld(16);
    deserializeVoxelWorld(
      emptyDocument({
        layers: [{
          id: "l1",
          name: "Ground",
          visible: true,
          order: 0,
          voxels: {}
        }]
      }),
      world
    );

    const layer = world.getLayer("Ground");
    assert.ok(layer !== undefined);
    assert.equal(layer.opacity, 1);
    assert.equal(layer.compositing, "composite");
  });

  it("stacks layers by their saved order and renumbers them densely", () => {
    const world = new VoxelWorld(16);

    deserializeVoxelWorld(
      untrusted(emptyDocument({
        layers: [
          { id: "top", name: "Top", visible: true, order: 7, voxels: {} },
          { id: "ground", name: "Ground", visible: true, order: 2, voxels: {} }
        ]
      })),
      world
    );

    assert.deepEqual(
      world.getLayers().map(({ name, order }) => [name, order]),
      [["Top", 1], ["Ground", 0]]
    );
  });

  it("skips malformed coordinate keys", () => {
    const world = new VoxelWorld(16);

    deserializeVoxelWorld(
      untrusted({
        ...emptyDocument(),
        layers: [{
          id: "l1",
          name: "Ground",
          visible: true,
          order: 0,
          voxels: {
            "not,a,number": { block: 1, transform: 0 },
            "0,0,0": { block: 2, transform: 0 }
          }
        }]
      }),
      world
    );

    assert.equal(world.getVoxelAt({ x: 0, y: 0, z: 0 })?.blockId, 2);
    assert.equal(world.getLayer("Ground")?.voxelCount, 1);
  });

  it("throws when layers is not an array", () => {
    const world = new VoxelWorld(16);

    assert.throws(
      () => deserializeVoxelWorld(
        untrusted({ version: VOXEL_WORLD_VERSION, chunkSize: 16, tilesets: [] }),
        world
      ),
      /layers is not an array/
    );
  });

  it("re-partitions a document saved with another chunk size", () => {
    const voxels = {
      "0,0,0": { block: 1, transform: 0 },
      "7,0,0": { block: 2, transform: 0 },
      "8,0,0": { block: 3, transform: 0 },
      "15,9,-1": { block: 4, transform: 0 },
      "16,0,0": { block: 5, transform: 0 }
    };
    const world = new VoxelWorld(16);

    deserializeVoxelWorld(
      untrusted(emptyDocument({
        chunkSize: 8,
        layers: [{
          id: "l1",
          name: "Ground",
          visible: true,
          order: 0,
          voxels
        }]
      })),
      world
    );

    const layer = world.getLayer("Ground");
    assert.ok(layer !== undefined);
    assert.equal(layer.voxelCount, 5);
    assert.equal(layer.chunkCount, 3);
    assert.equal(world.getVoxelAt({ x: 15, y: 9, z: -1 })?.blockId, 4);

    const json = serializeVoxelWorld(world);
    assert.equal(json.chunkSize, 16);
    assert.deepEqual(
      Object.keys(json.layers[0].voxels).sort(),
      Object.keys(voxels).sort()
    );
  });

  it("leaves the world and tilesets untouched when the document is invalid", () => {
    const world = new VoxelWorld(16);
    world.addLayer("Existing");
    const tilesets = new TilesetList([kAtlas]);
    assert.throws(
      () => deserializeVoxelWorld(untrusted({ version: 3 }), world, { tilesets })
    );
    assert.equal(world.getLayers().length, 1);
    assert.equal(tilesets.has("atlas"), true);
  });

  it("applies the serialized layer position to local voxel keys", () => {
    const world = new VoxelWorld(16);
    deserializeVoxelWorld(emptyDocument({
      layers: [{
        id: "ground",
        name: "Ground",
        visible: true,
        order: 0,
        position: { x: 20, y: 3, z: -4 },
        voxels: {
          "2,1,5": { block: 1, transform: 0 }
        }
      }]
    }), world);

    assert.ok(world.getVoxelAt({ x: 22, y: 4, z: 1 }) !== undefined);
    assert.equal(world.getVoxelAt({ x: 2, y: 1, z: 5 }), undefined);
  });
});
