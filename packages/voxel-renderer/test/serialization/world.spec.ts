// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  deserializeVoxelWorld,
  serializeVoxelWorld,
  type VoxelWorldJSON
} from "../../src/serialization/index.ts";
import { VoxelWorld } from "../../src/world/index.ts";
import { BlockRegistry, resolveBlockDefinition } from "../../src/blocks/index.ts";
import type { TilesetDefinition } from "../../src/tileset/index.ts";
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

function untrusted(
  document: object
): VoxelWorldJSON {
  return JSON.parse(JSON.stringify(document));
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
  world.addObjectLayer("Spawns");

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
});

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

  it("includes the defaultTileSize only when one is passed", () => {
    const world = new VoxelWorld(16);

    assert.equal("defaultTileSize" in serializeVoxelWorld(world), false);
    assert.equal(
      serializeVoxelWorld(world, { defaultTileSize: 16 }).defaultTileSize,
      16
    );
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
  it("throws when version is not 1", () => {
    const world = new VoxelWorld(16);

    assert.throws(
      () => deserializeVoxelWorld(untrusted({ version: 2 }), world),
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

  it("defaults opacity and compositing for an older save file", () => {
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
    assert.equal(layer.compositing, "composite");
  });

  it("skips malformed coordinate keys", () => {
    const world = new VoxelWorld(16);

    deserializeVoxelWorld(
      untrusted({
        version: 1,
        chunkSize: 16,
        tilesets: [],
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
        untrusted({ version: 1, chunkSize: 16, tilesets: [] }),
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
      () => deserializeVoxelWorld(untrusted({ version: 2 }), world)
    );
    assert.equal(world.getLayers().length, 1);
  });

  it("applies the serialized layer position to local voxel keys", () => {
    const world = new VoxelWorld(16);
    deserializeVoxelWorld({
      version: 1,
      chunkSize: 16,
      tilesets: [],
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
    }, world);

    assert.ok(world.getVoxelAt({ x: 22, y: 4, z: 1 }) !== undefined);
    assert.equal(world.getVoxelAt({ x: 2, y: 1, z: 5 }), undefined);
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

describe("block properties round-trip", () => {
  it("survives a save and load through the registry", () => {
    const source = new BlockRegistry([
      makeBlockDef(1, "cube", {
        properties: { hardness: 5, material: "stone", solid: true }
      })
    ]);
    const json = serializeVoxelWorld(new VoxelWorld(16), { blocks: source });

    const restored = new BlockRegistry();
    deserializeVoxelWorld(
      JSON.parse(JSON.stringify(json)),
      new VoxelWorld(16),
      { blocks: restored }
    );

    assert.deepEqual(restored.propertiesOf(1), {
      hardness: 5,
      material: "stone",
      solid: true
    });
  });

  it("scrubs non-scalar properties from an untrusted document", () => {
    const json = JSON.parse(`{
      "version": 1,
      "chunkSize": 16,
      "tilesets": [],
      "layers": [],
      "blocks": [{
        "id": 1,
        "name": "Hostile",
        "shapeId": "cube",
        "faceTextures": {},
        "collidable": true,
        "properties": {
          "kept": "yes",
          "nested": { "deep": true },
          "__proto__": { "polluted": true }
        }
      }]
    }`);

    const restored = new BlockRegistry();
    deserializeVoxelWorld(json, new VoxelWorld(16), { blocks: restored });

    assert.deepEqual(restored.propertiesOf(1), { kept: "yes" });
    assert.equal(({} as Record<string, unknown>).polluted, undefined);
  });
});

describe("serializeVoxelWorld — block order", () => {
  function ids(
    registry: BlockRegistry
  ): number[] {
    return [...registry].map((block) => block.id);
  }

  it("writes the registry order, not the id order", () => {
    const registry = new BlockRegistry([
      makeBlockDef(1, "cube"),
      makeBlockDef(2, "cube"),
      makeBlockDef(3, "cube")
    ]);
    registry.moveTo(3, 0);

    const json = serializeVoxelWorld(new VoxelWorld(16), { blocks: registry });

    assert.deepEqual(
      json.blocks?.map((block) => block.id),
      [3, 1, 2]
    );
  });

  it("restores a non-id order through a round trip", () => {
    const source = new BlockRegistry([
      makeBlockDef(1, "cube"),
      makeBlockDef(2, "cube"),
      makeBlockDef(3, "cube")
    ]);
    source.moveTo(1, 2);

    const json = serializeVoxelWorld(new VoxelWorld(16), { blocks: source });
    const restored = new BlockRegistry();
    deserializeVoxelWorld(json, new VoxelWorld(16), { blocks: restored });

    assert.deepEqual(ids(restored), [2, 3, 1]);
    assert.deepEqual(ids(restored), ids(source));
  });
});
