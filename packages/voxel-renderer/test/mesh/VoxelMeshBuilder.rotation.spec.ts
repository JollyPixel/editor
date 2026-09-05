// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelTransform } from "../../src/world/index.ts";
import { makeBlockDef } from "../helpers/blocks.ts";
import {
  countChunkVertices,
  makeMeshFixture as makeFixture,
  CUBE_ID as kCubeId,
  RAMP_ID as kRampId,
  STAIR_ID as kStairId
} from "../helpers/meshFixture.ts";

describe("VoxelMeshBuilder — ramp rotation base cases (rot=0, rot=2)", () => {
  it("ramp back wall (PosZ) adjacent to cube NegZ: cube NegZ face is hidden", () => {
    // rot=2 (180°) turns the ramp's back wall to face world NegZ, so placing
    // the ramp at (0,0,1) puts that wall against the cube's PosZ face.
    const f = makeFixture();
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 1 }, {
      blockId: kRampId,
      transform: new VoxelTransform({ rotation: 2 }).packed
    });

    // Cube: 5 faces (PosZ hidden by the ramp's back wall) = 20 verts.
    // Ramp(rot=2): 14 verts — NegY, NegX, PosX and the slope; the back wall
    // is culled against the cube.
    assert.equal(countChunkVertices(f), 34);
  });

  it("ramp open front (NegZ) adjacent to cube PosZ: cube PosZ face is visible", () => {
    // Ramp at (0,0,1) rot=0: open front (no NegZ geometry) faces world NegZ → cube's PosZ.
    const f = makeFixture();
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 1 }, {
      blockId: kRampId,
      transform: new VoxelTransform({ rotation: 0 }).packed
    });

    // The ramp's open front (rot=0) has no NegZ geometry, so it never
    // occludes the cube's PosZ face: 24 cube verts + 18 ramp verts = 42.
    assert.equal(countChunkVertices(f), 42);
  });
});

describe("VoxelMeshBuilder — neighbour rotation inversion fix (rot=1 / rot=3)", () => {
  it("ramp(rot=1) open front adjacent to cube: cube face NOT incorrectly hidden", () => {
    // rot=1 (90° CCW): local NegZ (open front) → world NegX.
    // Ramp at (1,0,0) rot=1: its open front faces world NegX = toward cube(0,0,0).
    // Before fix: rotateFace(NegX, 1) = PosZ → occludes(PosZ)=true → cube PosX WRONGLY hidden.
    // After fix:  rotateFace(NegX, 3) = NegZ → occludes(NegZ)=false → cube PosX visible.
    const f = makeFixture();
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    f.world.setVoxelAt("test", { x: 1, y: 0, z: 0 }, {
      blockId: kRampId,
      transform: new VoxelTransform({ rotation: 1 }).packed
    });

    // Cube keeps all 6 faces (24 verts); the ramp's open front (rot=1) faces
    // away from the cube, so none of its 5 faces are culled either (18 verts).
    assert.equal(countChunkVertices(f), 42);
  });

  it("ramp(rot=3) back wall adjacent to cube: cube face correctly hidden", () => {
    // rot=3 (270° CCW = 90° CW): local PosZ (back wall) → world NegX.
    // Ramp at (1,0,0) rot=3: back wall faces world NegX = toward cube(0,0,0) at world x=1.
    // Before fix: rotateFace(NegX, 3) = NegZ → occludes(NegZ)=false → cube PosX WRONGLY shown.
    // After fix:  rotateFace(NegX, 1) = PosZ → occludes(PosZ)=true → cube PosX hidden.
    const f = makeFixture();
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    f.world.setVoxelAt("test", { x: 1, y: 0, z: 0 }, {
      blockId: kRampId,
      transform: new VoxelTransform({ rotation: 3 }).packed
    });

    // Cube's PosX face is hidden by the ramp's back wall (rot=3 turns it to
    // face NegX): 20 cube verts + the ramp's remaining 14 = 34.
    assert.equal(countChunkVertices(f), 34);
  });

  it("stair(rot=1) open front adjacent to cube: cube face NOT incorrectly hidden", () => {
    // rot=1: stair local NegZ (partial front wall) → world NegX = toward cube(0,0,0).
    // The stair only partially covers NegZ (y=0..0.5), so occludes(NegZ)=false.
    // Before fix: rotateFace(NegX, 1) = PosZ → occludes(PosZ)=true → cube PosX WRONGLY hidden.
    // After fix:  rotateFace(NegX, 3) = NegZ → occludes(NegZ)=false → cube PosX visible.
    const f = makeFixture();
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    f.world.setVoxelAt("test", { x: 1, y: 0, z: 0 }, {
      blockId: kStairId,
      transform: new VoxelTransform({ rotation: 1 }).packed
    });

    // Cube keeps all 6 faces (24 verts). Of the stair's 10 constituent faces,
    // 9 are emitted at 4 verts each (36 verts) — the tenth is culled where it
    // meets the cube.
    assert.equal(countChunkVertices(f), 60);
  });

  it("ramp(rot=1) back wall adjacent to cube NegX: cube NegX face correctly hidden", () => {
    // rot=1: local PosZ (back wall) → world PosX.
    // Ramp at (-1,0,0) rot=1: back wall (local z=1 → world x=0) faces world PosX = cube's NegX.
    // Before fix: rotateFace(PosX=0, 1) = NegZ → occludes(NegZ)=false → cube NegX WRONGLY shown.
    // After fix:  rotateFace(PosX=0, 3) = PosZ → occludes(PosZ)=true → cube NegX correctly hidden.
    const f = makeFixture();
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    f.world.setVoxelAt("test", { x: -1, y: 0, z: 0 }, {
      blockId: kRampId,
      transform: new VoxelTransform({ rotation: 1 }).packed
    });

    // Ramp is in chunk (-1,0,0), only the cube chunk (0,0,0) is built here.
    // Cube: 5 faces (NegX correctly hidden by ramp back wall) = 20 verts.
    assert.equal(countChunkVertices(f), 20);
  });
});

describe("VoxelMeshBuilder — a neighbour never hides a face it does not touch", () => {
  const kSlabBottomId = 6;
  const kSlabTopId = 7;
  const kPoleYId = 8;

  function makeShapeFixture() {
    const f = makeFixture();
    f.blockRegistry.register(makeBlockDef(kSlabBottomId, "slabBottom", { name: "SlabBottom" }));
    f.blockRegistry.register(makeBlockDef(kSlabTopId, "slabTop", { name: "SlabTop" }));
    f.blockRegistry.register(makeBlockDef(kPoleYId, "poleY", { name: "PoleY" }));

    return f;
  }

  it("keeps the ramp slope under a cube, since air separates the two", () => {
    const f = makeShapeFixture();
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kRampId, transform: 0 });
    f.world.setVoxelAt("test", { x: 0, y: 1, z: 0 }, { blockId: kCubeId, transform: 0 });

    // The ramp's slope spans y=0 to y=1, so the cube covers only its top edge.
    // Ramp keeps all 5 faces (18 verts); the cube keeps all 6 (24 verts)
    // because a ramp does not occlude PosY.
    assert.equal(countChunkVertices(f), 42);
    assert.equal(f.builder.stats.culledFaces, 0);
  });

  it("keeps a bottom slab's top face under a cube", () => {
    const f = makeShapeFixture();
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kSlabBottomId, transform: 0 });
    f.world.setVoxelAt("test", { x: 0, y: 1, z: 0 }, { blockId: kCubeId, transform: 0 });

    // The slab's top sits at y=0.5, half a block below the cube.
    assert.equal(countChunkVertices(f), 48);
    assert.equal(f.builder.stats.culledFaces, 0);
  });

  it("keeps a top slab's bottom face above a cube", () => {
    const f = makeShapeFixture();
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    f.world.setVoxelAt("test", { x: 0, y: 1, z: 0 }, { blockId: kSlabTopId, transform: 0 });

    assert.equal(countChunkVertices(f), 48);
    assert.equal(f.builder.stats.culledFaces, 0);
  });

  it("keeps a stair's lower tread under a cube but still culls the upper one", () => {
    const f = makeShapeFixture();
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kStairId, transform: 0 });
    f.world.setVoxelAt("test", { x: 0, y: 1, z: 0 }, { blockId: kCubeId, transform: 0 });

    // Only the upper tread reaches y=1: 9 of the stair's 10 faces survive
    // (36 verts) alongside the cube's 6 (24 verts).
    assert.equal(countChunkVertices(f), 60);
    assert.equal(f.builder.stats.culledFaces, 1);
  });

  it("keeps a pole's side faces beside a cube", () => {
    const f = makeShapeFixture();
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kPoleYId, transform: 0 });
    f.world.setVoxelAt("test", { x: 1, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });

    // The pole is inset to x=0.375..0.625, so the cube touches none of it.
    assert.equal(countChunkVertices(f), 48);
    assert.equal(f.builder.stats.culledFaces, 0);
  });
});
