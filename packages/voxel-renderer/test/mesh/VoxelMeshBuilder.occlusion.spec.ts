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
    const fixture = makeFixture();
    const glass = fixture.world.addLayer("glass", { opacity: 0.5 });
    fixture.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    glass.setVoxelAt({ x: 1, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });

    // All 6 faces of the "test" cube are emitted — the glass neighbour never occludes.
    assert.equal(countChunkVertices(fixture), 24);
  });

  it("a neighbour in a fully opaque layer (opacity === 1) still occludes normally", () => {
    const fixture = makeFixture();
    const solid = fixture.world.addLayer("solid");
    fixture.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    solid.setVoxelAt({ x: 1, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });

    // PosX face of the "test" cube is hidden by the opaque neighbour: 5 faces = 20 verts.
    assert.equal(countChunkVertices(fixture), 20);
  });

  it("a translucent layer keeps every face, even against an opaque neighbour", () => {
    const fixture = makeFixture();
    const glass = fixture.world.addLayer("glass", { opacity: 0.5 });
    glass.setVoxelAt({ x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    fixture.world.setVoxelAt("test", { x: 1, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });

    // Culling a face you can see through leaves a hole into geometry that was never emitted.
    assert.equal(countLayerVertices(fixture, glass), 24);
  });

  it("a translucent layer still occludes itself", () => {
    const fixture = makeFixture();
    fixture.layer.opacity = 0.5;
    fixture.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    fixture.world.setVoxelAt("test", { x: 1, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });

    /*
     * 12 faces minus the 2 the cubes share: keeping them stacks coincident
     * blended quads, which reads as a checkerboard through the volume.
     */
    assert.equal(countChunkVertices(fixture), 40);
  });

  it("an opaque neighbour occludes through a translucent voxel sharing its cell", () => {
    const fixture = makeFixture();
    fixture.world.addLayer("glass", { opacity: 0.5 }).setVoxelAt(
      { x: 1, y: 0, z: 0 },
      { blockId: kCubeId, transform: 0 }
    );
    fixture.world.addLayer("stone").setVoxelAt(
      { x: 1, y: 0, z: 0 },
      { blockId: kCubeId, transform: 0 }
    );
    fixture.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });

    /*
     * The translucent layer is skipped rather than ending the search, so the
     * opaque layer under it still hides the PosX face: 5 faces = 20 verts.
     */
    assert.equal(countChunkVertices(fixture), 20);
  });

  it("a translucent layer does not suppress a lower-priority voxel it covers", () => {
    const fixture = makeFixture();
    const glass = fixture.world.addLayer("glass", { opacity: 0.5 });
    fixture.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    glass.setVoxelAt({ x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });

    assert.equal(countLayerVertices(fixture, glass), 24);
    assert.equal(countChunkVertices(fixture), 24);
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
    const fixture = makeFixture();
    fixture.blockRegistry.register(makeBlockDef(kLeavesId, "cube", {
      name: "Leaves", alphaMode: transparent ? "blend" : "opaque"
    }));

    return fixture;
  }

  it("keeps the solid neighbour's face, which is the one seen through the holes", () => {
    const fixture = withLeaves(true);
    fixture.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    fixture.world.setVoxelAt("test", { x: 1, y: 0, z: 0 }, { blockId: kLeavesId, transform: 0 });

    /*
     * The cube keeps all 6 faces; the leaves still lose the one the opaque
     * cube covers, which nothing can see through anyway. 24 + 20.
     */
    assert.equal(countChunkVertices(fixture), 44);
  });

  it("culls that face when the same block is not flagged transparent", () => {
    const fixture = withLeaves(false);
    fixture.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    fixture.world.setVoxelAt("test", { x: 1, y: 0, z: 0 }, { blockId: kLeavesId, transform: 0 });

    // 5 faces each: the cube's face is dropped and the holes look into nothing.
    assert.equal(countChunkVertices(fixture), 40);
  });

  it("culls the face two neighbours of the same transparent block share", () => {
    const fixture = withLeaves(true);
    fixture.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kLeavesId, transform: 0 });
    fixture.world.setVoxelAt("test", { x: 1, y: 0, z: 0 }, { blockId: kLeavesId, transform: 0 });

    /*
     * The canopy case: emitting both would put two coplanar quads on the
     * shared plane, which z-fight. 5 faces each.
     */
    assert.equal(countChunkVertices(fixture), 40);
  });

  it("keeps the shared face between two different transparent blocks", () => {
    const fixture = withLeaves(true);
    fixture.blockRegistry.register(
      makeBlockDef(kGrateId, "cube", { name: "Grate", alphaMode: "blend" })
    );
    fixture.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kLeavesId, transform: 0 });
    fixture.world.setVoxelAt("test", { x: 1, y: 0, z: 0 }, { blockId: kGrateId, transform: 0 });

    // Their holes do not line up, so each still shows through the other.
    assert.equal(countChunkVertices(fixture), 48);
  });

  it("splits their faces into a cutout geometry of the same tileset", () => {
    const fixture = withLeaves(true);
    fixture.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    fixture.world.setVoxelAt("test", { x: 2, y: 0, z: 0 }, { blockId: kLeavesId, transform: 0 });

    const geometries = buildGeometries(fixture);

    assert.deepEqual([...geometries.keys()], ["atlas", "atlas:cutout"]);
    const atlas = geometries.get("atlas");
    const cutout = geometries.get("atlas:cutout");
    assert.ok(atlas);
    assert.ok(cutout);
    assert.equal(atlas.getAttribute("position").count, 24);
    assert.equal(cutout.getAttribute("position").count, 24);
  });

  it("emits a single geometry when no block is transparent", () => {
    const fixture = withLeaves(false);
    fixture.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kLeavesId, transform: 0 });

    const geometries = buildGeometries(fixture);

    assert.deepEqual([...geometries.keys()], ["atlas"]);
  });
});
describe("VoxelMeshBuilder — neighbour lookups across chunks and layer offsets", () => {
  it("culls against an opaque layer whose offset shifts it onto a different chunk grid", () => {
    const fixture = makeFixture();
    /*
     * Offset by 2 on X, so this layer's chunk boundaries sit mid-way through
     * the meshed layer's — the neighbour lookup cannot assume a shared grid.
     */
    const shifted = fixture.world.addLayer("shifted");
    shifted.offset = { x: 2, y: 0, z: 0 };
    fixture.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    shifted.setVoxelAt({ x: 5, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });

    // Not adjacent: all 6 faces emitted.
    assert.equal(countChunkVertices(fixture), 24);

    /*
     * World x=1 is adjacent, but the offset puts it in the shifted layer's
     * chunk (-1,0,0) — a different grid cell than the chunk being meshed.
     */
    shifted.setVoxelAt({ x: 1, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });

    assert.equal(countChunkVertices(fixture), 20);
  });

  it("culls a face against a neighbour one chunk over", () => {
    const fixture = makeFixture();
    // chunkSize is 4: x=3 is the last column of chunk 0, x=4 the first of chunk 1.
    fixture.world.setVoxelAt("test", { x: 3, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    fixture.world.setVoxelAt("test", { x: 4, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });

    buildGeometries(fixture);

    assert.equal(fixture.builder.stats.culledFaces, 1);
    assert.equal(fixture.builder.stats.faces, 5);
  });

  it("culls a face against a neighbour one chunk below on the negative side", () => {
    const fixture = makeFixture();
    fixture.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    fixture.world.setVoxelAt("test", { x: -1, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });

    buildGeometries(fixture);

    assert.equal(fixture.builder.stats.culledFaces, 1);
    assert.equal(fixture.builder.stats.faces, 5);
  });
});

describe("VoxelMeshBuilder — cullSelfFaces", () => {
  function withGlass(
    cullSelfFaces: boolean,
    greedy = false
  ) {
    const fixture = makeFixture({ greedy });
    fixture.blockRegistry.register(
      makeBlockDef(kLeavesId, "cube", {
        name: "Glass",
        alphaMode: "blend",
        cullSelfFaces
      })
    );

    return fixture;
  }

  it("keeps the two directional appearances of a shared boundary", () => {
    const fixture = withGlass(false);
    fixture.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kLeavesId, transform: 0 });
    fixture.world.setVoxelAt("test", { x: 1, y: 0, z: 0 }, { blockId: kLeavesId, transform: 0 });

    buildGeometries(fixture);

    assert.equal(fixture.builder.stats.faces, 12);
    assert.equal(fixture.builder.stats.culledFaces, 0);
    assert.equal(countChunkVertices(fixture), 48);
  });

  it("keeps the boundary the same way under the greedy mesher", () => {
    const fixture = withGlass(false, true);
    fixture.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kLeavesId, transform: 0 });
    fixture.world.setVoxelAt("test", { x: 1, y: 0, z: 0 }, { blockId: kLeavesId, transform: 0 });

    buildGeometries(fixture);

    assert.equal(fixture.builder.stats.culledFaces, 0);
  });

  it("drops it again once the block culls its own faces", () => {
    const fixture = withGlass(true);
    fixture.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kLeavesId, transform: 0 });
    fixture.world.setVoxelAt("test", { x: 1, y: 0, z: 0 }, { blockId: kLeavesId, transform: 0 });

    assert.equal(countChunkVertices(fixture), 40);
  });

  it("keeps the boundary on both sides of a three-block run", () => {
    const fixture = withGlass(false);
    for (let x = 0; x < 3; x++) {
      fixture.world.setVoxelAt("test", { x, y: 0, z: 0 }, { blockId: kLeavesId, transform: 0 });
    }

    buildGeometries(fixture);

    assert.equal(fixture.builder.stats.faces, 18);
    assert.equal(fixture.builder.stats.culledFaces, 0);
  });

  it("still hides the faces an opaque neighbour covers", () => {
    const fixture = withGlass(false);
    fixture.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    fixture.world.setVoxelAt("test", { x: 1, y: 0, z: 0 }, { blockId: kLeavesId, transform: 0 });

    assert.equal(countChunkVertices(fixture), 44);
  });

  it("retains opaque boundaries for layers that may be faded", () => {
    const fixture = makeFixture();
    fixture.blockRegistry.register(
      makeBlockDef(kGrateId, "cube", { name: "Stone", cullSelfFaces: false })
    );
    fixture.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kGrateId, transform: 0 });
    fixture.world.setVoxelAt("test", { x: 1, y: 0, z: 0 }, { blockId: kGrateId, transform: 0 });

    assert.equal(countChunkVertices(fixture), 48);
  });
});
