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
} from "../../../src/document/serialization/index.ts";
import {
  voxelBlockId,
  VoxelWorld
} from "../../../src/document/world/index.ts";
import { TilesetList, type TilesetDefinition } from "../../../src/document/tilesets/index.ts";
import { makeVoxelEntry } from "../../helpers/voxelEntry.ts";

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
  world.templates.createFromLayer("Ground", {
    name: "House",
    id: "house",
    properties: { tag: "home" }
  });

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
    assert.deepEqual(restored.templates.get("house")?.properties, { tag: "home" });
  });

  it("widens the chunk bounds over every restored voxel", () => {
    const restored = new VoxelWorld(16);
    deserializeVoxelWorld(untrusted(serializeVoxelWorld(makeRichWorld())), restored);

    const chunk = restored.getLayer("Ground")?.getChunk(0, 0, 1);
    assert.ok(chunk !== undefined);
    assert.equal(chunk.mayContain(0, 0, 0), true);
    assert.equal(chunk.mayContain(5, 3, 2), true);
    assert.equal(chunk.mayContain(6, 0, 0), false);
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

  it("writes no block or material group table", () => {
    const json = serializeVoxelWorld(new VoxelWorld(16));

    assert.deepEqual(
      Object.keys(json).sort(),
      ["chunkSize", "layers", "objectLayers", "templates", "tilesets", "version"]
    );
  });

  it("writes a lone voxel as one sparse chunk over the layer palette", () => {
    const world = new VoxelWorld(16);
    const layer = world.addLayer("Ground");
    layer.setVoxelAt({ x: 3, y: 2, z: 1 }, makeVoxelEntry(5, 3));

    const { palette, chunks } = serializeVoxelWorld(world).layers[0];

    assert.deepEqual(palette, [{ block: 5, transform: 3 }]);
    assert.deepEqual(chunks, [{ at: [0, 0, 0], cells: [291], runs: [1, 1] }]);
  });

  it("lists the most frequent voxel first in the palette", () => {
    const world = new VoxelWorld(16);
    const layer = world.addLayer("Ground");
    layer.setVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry(2));
    for (let x = 1; x < 4; x++) {
      layer.setVoxelAt({ x, y: 0, z: 0 }, makeVoxelEntry(9, 1));
    }

    assert.deepEqual(serializeVoxelWorld(world).layers[0].palette, [
      { block: 9, transform: 1 },
      { block: 2, transform: 0 }
    ]);
  });

  it("writes a filled slab as dense runs", () => {
    const world = new VoxelWorld(4);
    const layer = world.addLayer("Ground");
    for (let x = 0; x < 4; x++) {
      for (let z = 0; z < 4; z++) {
        layer.setVoxelAt({ x, y: 0, z }, makeVoxelEntry(x < 2 ? 1 : 2));
      }
    }

    assert.deepEqual(serializeVoxelWorld(world).layers[0].chunks, [{
      at: [0, 0, 0],
      runs: [
        2, 1, 2, 2, 12, 0,
        2, 1, 2, 2, 12, 0,
        2, 1, 2, 2, 12, 0,
        2, 1, 2, 2, 12, 0
      ]
    }]);
  });

  it("stores chunks in layer-local space", () => {
    const world = new VoxelWorld(16);
    const layer = world.addLayer("Ground");
    layer.position = { x: 16, y: 0, z: 0 };
    layer.setVoxelAt({ x: 16, y: 0, z: 0 }, makeVoxelEntry(1));

    const json = serializeVoxelWorld(world);

    assert.deepEqual(json.layers[0].chunks, [
      { at: [0, 0, 0], cells: [0], runs: [1, 1] }
    ]);
  });

  it("writes the same document whatever order the voxels were placed in", () => {
    const entries: [number, number, number, number][] = [
      [40, 0, 0, 3],
      [0, 0, 0, 2],
      [0, 20, -5, 1],
      [1, 0, 0, 2]
    ];
    const forward = new VoxelWorld(16);
    const backward = new VoxelWorld(16);
    const a = forward.restoreLayer({ id: "ground", name: "Ground" });
    const b = backward.restoreLayer({ id: "ground", name: "Ground" });
    for (const [x, y, z, block] of entries) {
      a.setVoxelAt({ x, y, z }, makeVoxelEntry(block));
    }
    for (const [x, y, z, block] of [...entries].reverse()) {
      b.setVoxelAt({ x, y, z }, makeVoxelEntry(block));
    }

    assert.deepEqual(serializeVoxelWorld(backward), serializeVoxelWorld(forward));
  });
});

describe("deserializeVoxelWorld", () => {
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

  it("defaults compositing and drops a retired opacity in an older save file", () => {
    const world = new VoxelWorld(16);
    deserializeVoxelWorld(
      untrusted({
        ...emptyDocument(),
        layers: [{
          id: "l1",
          name: "Ground",
          visible: true,
          opacity: 0.5,
          rank: "V",
          palette: [],
          chunks: []
        }]
      }),
      world
    );

    const layer = world.getLayer("Ground");
    assert.ok(layer !== undefined);
    assert.equal(layer.compositing, "composite");
    assert.equal("opacity" in serializeVoxelWorld(world).layers[0], false);
  });

  it("stacks layers by their saved rank and renumbers them densely", () => {
    const world = new VoxelWorld(16);

    deserializeVoxelWorld(
      untrusted(emptyDocument({
        layers: [
          { id: "ground", name: "Ground", visible: true, rank: "2", palette: [], chunks: [] },
          { id: "top", name: "Top", visible: true, rank: "7", palette: [], chunks: [] }
        ]
      })),
      world
    );

    assert.deepEqual(
      world.getLayers().map(({ name, order }) => [name, order]),
      [["Top", 1], ["Ground", 0]]
    );
  });

  it("ignores unknown layer and chunk fields", () => {
    const world = new VoxelWorld(16);

    deserializeVoxelWorld(
      untrusted({
        ...emptyDocument(),
        layers: [{
          id: "l1",
          name: "Ground",
          visible: true,
          rank: "V",
          tint: "red",
          palette: [{ block: 2, transform: 0 }],
          chunks: [{ at: [0, 0, 0], cells: [0], runs: [1, 1], lod: 2 }]
        }]
      }),
      world
    );

    assert.equal(world.getVoxelAt({ x: 0, y: 0, z: 0 })?.blockId, 2);
  });

  it("re-partitions a document saved with another chunk size", () => {
    const world = new VoxelWorld(16);

    deserializeVoxelWorld(
      untrusted(emptyDocument({
        chunkSize: 8,
        layers: [{
          id: "l1",
          name: "Ground",
          visible: true,
          rank: "V",
          palette: [1, 2, 3, 4, 5].map((block) => {
            return { block, transform: 0 };
          }),
          chunks: [
            { at: [0, 0, 0], cells: [0, 6], runs: [1, 1, 1, 2] },
            { at: [1, 0, 0], cells: [0], runs: [1, 3] },
            { at: [1, 1, -1], cells: [463], runs: [1, 4] },
            { at: [2, 0, 0], cells: [0], runs: [1, 5] }
          ]
        }]
      })),
      world
    );

    const layer = world.getLayer("Ground");
    assert.ok(layer !== undefined);
    assert.equal(layer.voxelCount, 5);
    assert.equal(layer.chunkCount, 3);
    assert.deepEqual(
      Array.from(layer.localVoxels(), ([x, y, z, packed]) => [x, y, z, voxelBlockId(packed)])
        .sort((p, q) => p[3] - q[3]),
      [
        [0, 0, 0, 1],
        [7, 0, 0, 2],
        [8, 0, 0, 3],
        [15, 9, -1, 4],
        [16, 0, 0, 5]
      ]
    );
    assert.equal(serializeVoxelWorld(world).chunkSize, 16);
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

  it("leaves the world untouched when a chunk does not fit its chunk size", () => {
    const world = new VoxelWorld(16);
    world.addLayer("Existing");
    const tilesets = new TilesetList([kAtlas]);

    assert.throws(
      () => deserializeVoxelWorld(untrusted(emptyDocument({
        chunkSize: 32,
        layers: [{
          id: "l1",
          name: "Ground",
          visible: true,
          rank: "V",
          palette: [{ block: 1, transform: 0 }],
          chunks: [{ at: [1000, 0, 0], cells: [0], runs: [1, 1] }]
        }]
      })), world, { tilesets }),
      /layer "l1", chunk \[1000,0,0\] does not fit a world with chunkSize 16/
    );
    assert.deepEqual(world.getLayers().map(({ name }) => name), ["Existing"]);
    assert.equal(tilesets.has("atlas"), true);
  });

  it("reads a template in the chunk size it was saved with", () => {
    const world = new VoxelWorld(16);
    deserializeVoxelWorld(untrusted(emptyDocument({
      templates: [{
        id: "t1",
        name: "Pair",
        pivot: { x: 5, y: 0, z: 0 },
        chunkSize: 4,
        palette: [
          { block: 1, transform: 0 },
          { block: 2, transform: 5 }
        ],
        chunks: [
          { at: [0, 0, 0], cells: [0], runs: [1, 1] },
          { at: [1, 0, 0], cells: [1], runs: [1, 2] }
        ]
      }]
    })), world);

    const template = world.templates.get("t1");
    assert.ok(template !== undefined);
    assert.deepEqual(
      Array.from(template.localVoxels(), ([x, y, z, packed]) => [x, y, z, voxelBlockId(packed)]),
      [[0, 0, 0, 1], [5, 0, 0, 2]]
    );
    assert.deepEqual(template.pivot, { x: 5, y: 0, z: 0 });
    assert.equal(serializeVoxelWorld(world).templates?.[0].chunkSize, 16);
  });

  it("applies the serialized layer position to local voxel keys", () => {
    const world = new VoxelWorld(16);
    deserializeVoxelWorld(emptyDocument({
      layers: [{
        id: "ground",
        name: "Ground",
        visible: true,
        rank: "V",
        position: { x: 20, y: 3, z: -4 },
        palette: [{ block: 1, transform: 0 }],
        chunks: [{ at: [0, 0, 0], cells: [1298], runs: [1, 1] }]
      }]
    }), world);

    assert.ok(world.getVoxelAt({ x: 22, y: 4, z: 1 }) !== undefined);
    assert.equal(world.getVoxelAt({ x: 2, y: 1, z: 5 }), undefined);
  });
});
