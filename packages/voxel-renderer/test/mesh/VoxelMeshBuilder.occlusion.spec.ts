// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { makeBlockDef } from "../helpers/blocks.ts";
import {
  buildGeometries,
  countChunkVertices,
  countLayerVertices,
  makeMeshFixture as makeFixture,
  CUBE_ID as kCubeId
} from "../helpers/meshFixture.ts";

// CONSTANTS
const kLeavesId = 4;
const kGrateId = 5;

describe("VoxelMeshBuilder — opacity affects occlusion", () => {
  it("a neighbour in a translucent layer (opacity < 1) does not occlude", () => {
    const f = makeFixture();
    const glass = f.world.addLayer("glass", { opacity: 0.5 });
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    glass.setVoxelAt({ x: 1, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });

    // All 6 faces of the "test" cube are emitted — the glass neighbour never occludes.
    assert.equal(countChunkVertices(f), 24);
  });

  it("a neighbour in a fully opaque layer (opacity === 1) still occludes normally", () => {
    const f = makeFixture();
    const solid = f.world.addLayer("solid");
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    solid.setVoxelAt({ x: 1, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });

    // PosX face of the "test" cube is hidden by the opaque neighbour: 5 faces = 20 verts.
    assert.equal(countChunkVertices(f), 20);
  });

  it("a translucent layer keeps every face, even against an opaque neighbour", () => {
    const f = makeFixture();
    const glass = f.world.addLayer("glass", { opacity: 0.5 });
    glass.setVoxelAt({ x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    f.world.setVoxelAt("test", { x: 1, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });

    // Culling a face you can see through leaves a hole into geometry that was never emitted.
    assert.equal(countLayerVertices(f, glass), 24);
  });

  it("a translucent layer still occludes itself", () => {
    const f = makeFixture();
    f.layer.opacity = 0.5;
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    f.world.setVoxelAt("test", { x: 1, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });

    // 12 faces minus the 2 the cubes share: keeping them stacks coincident
    // blended quads, which reads as a checkerboard through the volume.
    assert.equal(countChunkVertices(f), 40);
  });

  it("an opaque neighbour occludes through a translucent voxel sharing its cell", () => {
    const f = makeFixture();
    f.world.addLayer("glass", { opacity: 0.5 }).setVoxelAt(
      { x: 1, y: 0, z: 0 },
      { blockId: kCubeId, transform: 0 }
    );
    f.world.addLayer("stone").setVoxelAt(
      { x: 1, y: 0, z: 0 },
      { blockId: kCubeId, transform: 0 }
    );
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });

    // The translucent layer is skipped rather than ending the search, so the
    // opaque layer under it still hides the PosX face: 5 faces = 20 verts.
    assert.equal(countChunkVertices(f), 20);
  });

  it("a translucent layer does not suppress a lower-priority voxel it covers", () => {
    const f = makeFixture();
    const glass = f.world.addLayer("glass", { opacity: 0.5 });
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    glass.setVoxelAt({ x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });

    assert.equal(countLayerVertices(f, glass), 24);
    assert.equal(countChunkVertices(f), 24);
  });
});

describe("VoxelMeshBuilder — transparent blocks occlude only themselves", () => {
  /**
   * A cutout tile (leaves, a grate, a window) is opaque as far as the mesher
   * can tell, so without the flag its neighbours are culled and the holes look
   * into geometry that was never emitted.
   */
  function withLeaves(
    transparent: boolean
  ) {
    const f = makeFixture();
    f.blockRegistry.register(makeBlockDef(kLeavesId, "cube", { name: "Leaves", transparent }));

    return f;
  }

  it("keeps the solid neighbour's face, which is the one seen through the holes", () => {
    const f = withLeaves(true);
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    f.world.setVoxelAt("test", { x: 1, y: 0, z: 0 }, { blockId: kLeavesId, transform: 0 });

    // The cube keeps all 6 faces; the leaves still lose the one the opaque
    // cube covers, which nothing can see through anyway. 24 + 20.
    assert.equal(countChunkVertices(f), 44);
  });

  it("culls that face when the same block is not flagged transparent", () => {
    const f = withLeaves(false);
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    f.world.setVoxelAt("test", { x: 1, y: 0, z: 0 }, { blockId: kLeavesId, transform: 0 });

    // 5 faces each: the cube's face is dropped and the holes look into nothing.
    assert.equal(countChunkVertices(f), 40);
  });

  it("culls the face two neighbours of the same transparent block share", () => {
    const f = withLeaves(true);
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kLeavesId, transform: 0 });
    f.world.setVoxelAt("test", { x: 1, y: 0, z: 0 }, { blockId: kLeavesId, transform: 0 });

    // The canopy case: emitting both would put two coplanar quads on the
    // shared plane, which z-fight. 5 faces each.
    assert.equal(countChunkVertices(f), 40);
  });

  it("keeps the shared face between two different transparent blocks", () => {
    const f = withLeaves(true);
    f.blockRegistry.register(
      makeBlockDef(kGrateId, "cube", { name: "Grate", transparent: true })
    );
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kLeavesId, transform: 0 });
    f.world.setVoxelAt("test", { x: 1, y: 0, z: 0 }, { blockId: kGrateId, transform: 0 });

    // Their holes do not line up, so each still shows through the other.
    assert.equal(countChunkVertices(f), 48);
  });

  it("splits their faces into a cutout geometry of the same tileset", () => {
    const f = withLeaves(true);
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    f.world.setVoxelAt("test", { x: 2, y: 0, z: 0 }, { blockId: kLeavesId, transform: 0 });

    const geometries = buildGeometries(f);

    assert.deepEqual([...geometries.keys()], ["atlas", "atlas:cutout"]);
    const atlas = geometries.get("atlas");
    const cutout = geometries.get("atlas:cutout");
    assert.ok(atlas);
    assert.ok(cutout);
    assert.equal(atlas.getAttribute("position").count, 24);
    assert.equal(cutout.getAttribute("position").count, 24);
  });

  it("emits a single geometry when no block is transparent", () => {
    const f = withLeaves(false);
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kLeavesId, transform: 0 });

    const geometries = buildGeometries(f);

    assert.deepEqual([...geometries.keys()], ["atlas"]);
  });
});
describe("VoxelMeshBuilder — neighbour lookups across chunks and layer offsets", () => {
  it("culls against an opaque layer whose offset shifts it onto a different chunk grid", () => {
    const f = makeFixture();
    // Offset by 2 on X, so this layer's chunk boundaries sit mid-way through
    // the meshed layer's — the neighbour lookup cannot assume a shared grid.
    const shifted = f.world.addLayer("shifted");
    shifted.offset = { x: 2, y: 0, z: 0 };
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    shifted.setVoxelAt({ x: 5, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });

    // Not adjacent: all 6 faces emitted.
    assert.equal(countChunkVertices(f), 24);

    // World x=1 is adjacent, but the offset puts it in the shifted layer's
    // chunk (-1,0,0) — a different grid cell than the chunk being meshed.
    shifted.setVoxelAt({ x: 1, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });

    assert.equal(countChunkVertices(f), 20);
  });

  it("culls a face against a neighbour one chunk over", () => {
    const f = makeFixture();
    // chunkSize is 4: x=3 is the last column of chunk 0, x=4 the first of chunk 1.
    f.world.setVoxelAt("test", { x: 3, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    f.world.setVoxelAt("test", { x: 4, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });

    buildGeometries(f);

    assert.equal(f.builder.stats.culledFaces, 1);
    assert.equal(f.builder.stats.faces, 5);
  });

  it("culls a face against a neighbour one chunk below on the negative side", () => {
    const f = makeFixture();
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    f.world.setVoxelAt("test", { x: -1, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });

    buildGeometries(f);

    assert.equal(f.builder.stats.culledFaces, 1);
    assert.equal(f.builder.stats.faces, 5);
  });
});
