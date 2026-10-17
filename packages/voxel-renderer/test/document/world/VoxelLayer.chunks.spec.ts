// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelLayer } from "../../../src/document/world/index.ts";
import { serializeVoxelLayer } from "../../../src/document/serialization/index.ts";
import { makeVoxelEntry } from "../../helpers/voxelEntry.ts";
import { voxelContent } from "../../helpers/world.ts";

// CONSTANTS
const kOutOfRangeCoord = 1 << 20;

function makeLayer(opts?: Partial<ConstructorParameters<typeof VoxelLayer>[0]>) {
  return new VoxelLayer({
    id: "test",
    name: "Test",
    order: 0,
    chunkSize: 4,
    ...opts
  });
}

describe("VoxelLayer getChunks", () => {
  it("yields all live chunks", () => {
    const layer = makeLayer({ chunkSize: 4 });
    layer.setVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry());
    layer.setVoxelAt({ x: 4, y: 0, z: 0 }, makeVoxelEntry());
    const chunks = [...layer.getChunks()];
    assert.equal(chunks.length, 2);
  });
});

describe("VoxelLayer clone", () => {
  it("applies overrides on the fly", () => {
    const layer = makeLayer({ chunkSize: 4 });
    const clone = layer.clone({ visible: false, name: "Cloned" });
    assert.deepEqual(serializeVoxelLayer(clone), {
      ...serializeVoxelLayer(layer), visible: false, name: "Cloned"
    });
  });

  it("carries the voxels over", () => {
    const layer = makeLayer({ chunkSize: 4 });
    const entry = makeVoxelEntry(6, 1);
    layer.setVoxelAt({ x: 1, y: 2, z: 3 }, entry);
    layer.setVoxelAt({ x: 9, y: 0, z: 0 }, makeVoxelEntry(2, 0));

    const clone = layer.clone();

    assert.equal(clone.chunkCount, layer.chunkCount);
    assert.deepEqual(clone.getVoxelAt({ x: 1, y: 2, z: 3 }), entry);
    assert.deepEqual(voxelContent(clone), voxelContent(layer));
  });

  it("shares no voxel storage with the source", () => {
    const layer = makeLayer({ chunkSize: 4 });
    layer.setVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry(1, 0));

    const clone = layer.clone();
    clone.setVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry(5, 0));
    clone.removeVoxelAt({ x: 0, y: 0, z: 0 });
    clone.setVoxelAt({ x: 20, y: 0, z: 0 }, makeVoxelEntry(3, 0));

    assert.deepEqual(
      layer.getVoxelAt({ x: 0, y: 0, z: 0 }),
      makeVoxelEntry(1, 0)
    );
    assert.equal(layer.getVoxelAt({ x: 20, y: 0, z: 0 }), undefined);
  });

  it("keeps the source chunk size whatever the overrides ask for", () => {
    const layer = makeLayer({ chunkSize: 4 });
    layer.setVoxelAt({ x: 5, y: 0, z: 0 }, makeVoxelEntry());

    const clone = layer.clone({ chunkSize: 16 });

    assert.deepEqual(
      clone.getVoxelAt({ x: 5, y: 0, z: 0 }),
      makeVoxelEntry()
    );
  });

  it("copies position and properties rather than sharing them", () => {
    const layer = makeLayer({
      chunkSize: 4,
      position: { x: 1, y: 2, z: 3 },
      properties: { biome: "forest" }
    });

    const clone = layer.clone();
    clone.position.x = 99;
    clone.properties.biome = "desert";

    assert.deepEqual(layer.position, { x: 1, y: 2, z: 3 });
    assert.deepEqual(layer.properties, { biome: "forest" });
  });
});

describe("VoxelLayer mergeFrom overwrite", () => {
  it("replaces overlapping voxels by default", () => {
    const source = makeLayer({ id: "src", name: "Source" });
    const target = makeLayer({ id: "tgt", name: "Target" });
    target.setVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry(1, 0));
    source.setVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry(9, 0));

    target.mergeFrom(source);

    assert.deepEqual(
      target.getVoxelAt({ x: 0, y: 0, z: 0 }),
      makeVoxelEntry(9, 0)
    );
  });

  it("keeps the target's voxels when overwrite is off", () => {
    const source = makeLayer({ id: "src", name: "Source" });
    const target = makeLayer({ id: "tgt", name: "Target" });
    target.setVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry(1, 0));
    source.setVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry(9, 0));
    source.setVoxelAt({ x: 1, y: 0, z: 0 }, makeVoxelEntry(8, 0));

    target.mergeFrom(source, { overwrite: false });

    assert.deepEqual(
      target.getVoxelAt({ x: 0, y: 0, z: 0 }),
      makeVoxelEntry(1, 0)
    );
    assert.deepEqual(
      target.getVoxelAt({ x: 1, y: 0, z: 0 }),
      makeVoxelEntry(8, 0)
    );
  });
});

describe("VoxelLayer mergeFrom", () => {
  it("copies voxels at correct world positions (both layers at position {0,0,0})", () => {
    const source = makeLayer({ id: "src", name: "Source" });
    const target = makeLayer({ id: "tgt", name: "Target" });
    const entry = makeVoxelEntry(5, 2);
    source.setVoxelAt({ x: 2, y: 1, z: 3 }, entry);

    target.mergeFrom(source);

    assert.deepEqual(target.getVoxelAt({ x: 2, y: 1, z: 3 }), entry);
  });

  it(
    "applies source position: voxel at local (1,0,0) with source position {5,0,0} lands at world (6,0,0)",
    () => {
      const source = makeLayer({ id: "src", name: "Source", position: { x: 5, y: 0, z: 0 } });
      const target = makeLayer({ id: "tgt", name: "Target" });
      const entry = makeVoxelEntry(3, 0);
      source.setVoxelAt({ x: 6, y: 0, z: 0 }, entry);

      target.mergeFrom(source);

      assert.deepEqual(target.getVoxelAt({ x: 6, y: 0, z: 0 }), entry);
      assert.equal(target.getVoxelAt({ x: 1, y: 0, z: 0 }), undefined);
    }
  );

  it("applies target position: target with position {3,0,0} stores world (6,0,0) at local (3,0,0)", () => {
    const source = makeLayer({ id: "src", name: "Source", position: { x: 5, y: 0, z: 0 } });
    const target = makeLayer({ id: "tgt", name: "Target", position: { x: 3, y: 0, z: 0 } });
    const entry = makeVoxelEntry(7, 1);
    source.setVoxelAt({ x: 6, y: 0, z: 0 }, entry);

    target.mergeFrom(source);

    assert.deepEqual(target.getVoxelAt({ x: 6, y: 0, z: 0 }), entry);
    assert.deepEqual(
      Array.from(target.localVoxels(), ([x, y, z]) => [x, y, z]),
      [[3, 0, 0]]
    );
  });

  it("source layer is not modified after merge", () => {
    const source = makeLayer({ id: "src", name: "Source" });
    const target = makeLayer({ id: "tgt", name: "Target" });
    const entry = makeVoxelEntry(2, 0);
    source.setVoxelAt({ x: 1, y: 1, z: 1 }, entry);

    target.mergeFrom(source);

    assert.deepEqual(source.getVoxelAt({ x: 1, y: 1, z: 1 }), entry);
    assert.equal(source.chunkCount, 1);
  });
});

describe("VoxelLayer chunk keys", () => {
  it("rejects a non power-of-two chunkSize", () => {
    assert.throws(
      () => makeLayer({ chunkSize: 12 }),
      /chunkSize must be a power of two, received 12/
    );
  });

  it("does not alias two chunks onto one key", () => {
    const layer = makeLayer({ chunkSize: 4 });
    const chunks = new Set();

    for (const cx of [-3, 0, 5]) {
      for (const cy of [-2, 0, 7]) {
        for (const cz of [-1, 0, 9]) {
          const chunk = layer.getOrCreateChunk(cx, cy, cz);
          assert.deepEqual([chunk.cx, chunk.cy, chunk.cz], [cx, cy, cz]);
          chunks.add(chunk);
        }
      }
    }

    assert.equal(chunks.size, 27);
    assert.equal(layer.chunkCount, 27);
  });

  it("throws rather than aliasing a chunk beyond the packable range", () => {
    const layer = makeLayer({ chunkSize: 4 });

    assert.throws(() => layer.getOrCreateChunk(kOutOfRangeCoord, 0, 0), RangeError);
    assert.throws(() => layer.getOrCreateChunk(0, kOutOfRangeCoord, 0), RangeError);
  });

  it("forgets the memoized chunk once it is dropped", () => {
    const layer = makeLayer({ chunkSize: 4 });
    layer.setVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry());
    assert.ok(layer.getChunk(0, 0, 0));

    layer.removeVoxelAt({ x: 0, y: 0, z: 0 });

    assert.equal(layer.getChunk(0, 0, 0), undefined);
    assert.equal(layer.chunkCount, 0);
  });
});

describe("VoxelLayer chunk range edges", () => {
  it("answers undefined rather than throwing for a chunk past the range", () => {
    const layer = makeLayer({ chunkSize: 4 });

    assert.equal(layer.getChunk(kOutOfRangeCoord, 0, 0), undefined);
    assert.equal(layer.getChunk(0, -kOutOfRangeCoord, 0), undefined);
  });

  it("marks a neighbour past the edge of the world without throwing", () => {
    const layer = makeLayer({ chunkSize: 4 });

    assert.doesNotThrow(() => layer.markChunkDirty(-kOutOfRangeCoord, 0, 0));
  });
});

describe("VoxelLayer loadPackedVoxels", () => {
  it("writes layer-local voxels across chunks", () => {
    const layer = makeLayer({ position: { x: 10, y: 0, z: 0 } });
    const positions = new Int32Array([
      0, 0, 0,
      5, 1, -3,
      0, 0, 1,
      -1, 2, 2
    ]);

    layer.loadPackedVoxels(positions, [256, 513, 770, 1027]);

    assert.equal(layer.getPackedVoxelAt({ x: 10, y: 0, z: 0 }), 256);
    assert.equal(layer.getPackedVoxelAt({ x: 15, y: 1, z: -3 }), 513);
    assert.equal(layer.getPackedVoxelAt({ x: 10, y: 0, z: 1 }), 770);
    assert.equal(layer.getPackedVoxelAt({ x: 9, y: 2, z: 2 }), 1027);
    assert.equal(layer.voxelCount, 4);
    assert.equal(layer.chunkCount, 3);
  });

  it("marks the written chunks dirty", () => {
    const layer = makeLayer();

    layer.loadPackedVoxels(new Int32Array([1, 1, 1]), [256]);

    assert.equal(layer.getChunk(0, 0, 0)?.dirty, true);
  });
});
