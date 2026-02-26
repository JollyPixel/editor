// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelWorld } from "../../src/world/VoxelWorld.ts";
import { BlockRegistry } from "../../src/blocks/BlockRegistry.ts";
import { BlockShapeRegistry } from "../../src/blocks/BlockShapeRegistry.ts";
import { TilesetManager } from "../../src/tileset/TilesetManager.ts";
import { VoxelMeshBuilder } from "../../src/mesh/VoxelMeshBuilder.ts";
import { packTransform } from "../../src/utils/math.ts";

// CONSTANTS
const kCubeId = 1;
const kRampId = 2;
const kStairId = 3;
const kDefaultTexture = { col: 0, row: 0 };

/**
 * Minimal mock texture; registerTexture() assigns magFilter/etc then reads
 * image.width / image.height only when cols/rows are omitted from the def.
 * By supplying explicit cols + rows we avoid any DOM image dependency.
 */
function mockTexture(): any {
  return {
    magFilter: 0,
    minFilter: 0,
    colorSpace: "",
    generateMipmaps: true,
    image: { width: 64, height: 64 }
  };
}

/**
 * Builds a fully functional (non-rendering) fixture: world (chunkSize=4),
 * block registry with cube / ramp / stair, default shape registry, and a
 * TilesetManager with a dummy atlas registered so UV lookup succeeds.
 */
function makeFixture() {
  const world = new VoxelWorld(4);
  const layer = world.addLayer("test");

  const blockRegistry = new BlockRegistry([
    { id: kCubeId, name: "Cube", shapeId: "cube", faceTextures: {}, defaultTexture: kDefaultTexture, collidable: true },
    { id: kRampId, name: "Ramp", shapeId: "ramp", faceTextures: {}, defaultTexture: kDefaultTexture, collidable: true },
    { id: kStairId, name: "Stair", shapeId: "stair", faceTextures: {}, defaultTexture: kDefaultTexture, collidable: true }
  ]);

  const shapeRegistry = BlockShapeRegistry.createDefault();

  const tilesetManager = new TilesetManager();
  tilesetManager.registerTexture(
    { id: "atlas", src: "/atlas.png", tileSize: 16, cols: 4, rows: 4 },
    mockTexture()
  );

  const builder = new VoxelMeshBuilder({ world, blockRegistry, shapeRegistry, tilesetManager });

  return { world, layer, builder };
}

/**
 * Returns the total number of vertices emitted by the chunk at (0,0,0) across
 * all tileset geometries.  Each quad contributes 4 vertices; each triangle 3.
 */
function countVertices(fixture: ReturnType<typeof makeFixture>): number {
  const { layer, builder } = fixture;
  const chunk = layer.getChunk(0, 0, 0);
  if (!chunk) {
    return 0;
  }

  const geometries = builder.buildChunkGeometries(chunk, layer);
  if (!geometries) {
    return 0;
  }

  let total = 0;
  for (const geo of geometries.values()) {
    total += geo.getAttribute("position").count;
  }

  return total;
}

// ---------------------------------------------------------------------------
// Rotation table quick-reference used in all tests below
// (rot=1: PosX→NegZ, NegX→PosZ, PosZ→PosX, NegZ→NegX — 90° CCW around +Y)
// (rot=3: PosX→PosZ, NegX→NegZ, PosZ→NegX, NegZ→PosX — 270° CCW around +Y)
// ---------------------------------------------------------------------------

describe("VoxelMeshBuilder — isolated cube", () => {
  it("emits all 6 faces (24 vertices) when no neighbours exist", () => {
    const f = makeFixture();
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });

    // 6 quad faces × 4 vertices = 24
    assert.equal(countVertices(f), 24);
  });

  it("returns null when no blocks are placed", () => {
    const f = makeFixture();
    const chunk = f.layer.getOrCreateChunk(0, 0, 0);

    assert.equal(f.builder.buildChunkGeometries(chunk, f.layer), null);
  });
});

describe("VoxelMeshBuilder — ramp(rot=0) base cases (no rotation bug)", () => {
  it("ramp back wall (PosZ) adjacent to cube NegZ: cube NegZ face is hidden", () => {
    // Ramp at (0,0,1) rot=0: its local PosZ back wall is at world z=2,
    // but that is not adjacent to cube at (0,0,0). Instead we place the
    // ramp at (1,0,0) rot=0 and check the cube's PosX face.
    // For the original orientation check: ramp(rot=2) has back wall facing NegZ.
    // rot=2: rotateFace(PosZ,2)=NegZ → back wall faces world NegZ.
    // Ramp at (0,0,1) rot=2: back wall now faces NegZ → adjacent to cube(0,0,0)'s PosZ.
    const f = makeFixture();
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    // rot=2 (180°): packTransform(2, false, false)
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 1 }, {
      blockId: kRampId,
      transform: packTransform(2, false, false)
    });

    // Cube: 5 faces (PosZ hidden by ramp back wall) = 20 verts
    // Ramp(rot=2): faces — NegY(4), PosZ→NegZ world faces cube→NOT EMITTED, NegX(3), PosX(3), slope(4)
    //   ramp NegX face: rotateFace(NegX=1,2)=PosX → check (1,0,1) empty → 3 verts
    //   ramp PosX face: rotateFace(PosX=0,2)=NegX → check (-1,0,1) empty → 3 verts
    //   ramp PosZ back wall: rotateFace(PosZ=4,2)=NegZ → check (0,0,0)=cube → NOT EMITTED
    //   ramp NegY: check (0,-1,1) → 4 verts
    //   ramp slope(PosY): check (0,1,1) → 4 verts
    // Ramp total: 4+3+3+4 = 14 verts
    // Total: 20+14 = 34
    assert.equal(countVertices(f), 34);
  });

  it("ramp open front (NegZ) adjacent to cube PosZ: cube PosZ face is visible", () => {
    // Ramp at (0,0,1) rot=0: open front (no NegZ geometry) faces world NegZ → cube's PosZ.
    const f = makeFixture();
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 1 }, {
      blockId: kRampId,
      transform: packTransform(0, false, false)
    });

    // Cube: 6 faces (PosZ not hidden, ramp has no NegZ geometry) = 24 verts
    // Ramp(rot=0): NegY(4), PosZ back wall → check (0,0,2) empty(4), NegX(3), PosX(3), slope(4) = 18
    // Total: 24+18 = 42
    assert.equal(countVertices(f), 42);
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
      transform: packTransform(1, false, false)
    });

    // Cube: 6 faces = 24 verts
    // Ramp(rot=1): no face points toward cube(0,0,0) → all 5 faces emitted = 18 verts
    //   NegY(4), PosZ→world PosX→check(2,0,0) empty(4), NegX→world PosZ→check(1,0,1)(3),
    //   PosX→world NegZ→check(1,0,-1)(3), slope(4) = 18
    // Total: 42
    assert.equal(countVertices(f), 42);
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
      transform: packTransform(3, false, false)
    });

    // Cube: 5 faces (PosX hidden by ramp back wall) = 20 verts
    // Ramp(rot=3): back wall(PosZ→world NegX)→check(0,0,0)=cube→cube.occludes(PosX)=true→NOT EMITTED
    //   NegY(4), NegX→world NegZ→check(1,0,-1)(3), PosX→world PosZ→check(1,0,1)(3), slope(4) = 14
    // Total: 34
    assert.equal(countVertices(f), 34);
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
      transform: packTransform(1, false, false)
    });

    // Cube: 6 faces = 24 verts
    // Stair(rot=1) faces (10 total):
    //   NegY(4), PosZ→world PosX(4), NegZ→world NegX→cube.occludes(PosX)=true→NOT EMITTED,
    //   PosY step(4), PosY back top(4), inner riser sentinel(4),
    //   PosX lower→world NegZ(4), PosX upper back→world NegZ(4),
    //   NegX lower→world PosZ(4), NegX upper back→world PosZ(4)
    //   = 4+4+0+4+4+4+4+4+4+4 = 36 verts
    // Total: 24+36 = 60
    assert.equal(countVertices(f), 60);
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
      transform: packTransform(1, false, false)
    });

    // Ramp is in chunk (-1,0,0), only the cube chunk (0,0,0) is built here.
    // Cube: 5 faces (NegX correctly hidden by ramp back wall) = 20 verts.
    assert.equal(countVertices(f), 20);
  });
});
