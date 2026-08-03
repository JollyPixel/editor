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

  return { world, layer, builder, blockRegistry, tilesetManager };
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

describe("VoxelMeshBuilder — opacity affects occlusion", () => {
  it("a neighbour in a translucent layer (opacity < 1) does not occlude", () => {
    const f = makeFixture();
    const glass = f.world.addLayer("glass", { opacity: 0.5 });
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    glass.setVoxelAt({ x: 1, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });

    // All 6 faces of the "test" cube are emitted — the glass neighbour never occludes.
    assert.equal(countVertices(f), 24);
  });

  it("a neighbour in a fully opaque layer (opacity === 1) still occludes normally", () => {
    const f = makeFixture();
    const solid = f.world.addLayer("solid");
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    solid.setVoxelAt({ x: 1, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });

    // PosX face of the "test" cube is hidden by the opaque neighbour: 5 faces = 20 verts.
    assert.equal(countVertices(f), 20);
  });
});

describe("VoxelMeshBuilder — layer opacity is not a vertex attribute", () => {
  it("emits no color attribute, whatever the layer opacity", () => {
    for (const opacity of [1, 0.25]) {
      const f = makeFixture();
      f.layer.opacity = opacity;
      f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
      const chunk = f.layer.getChunk(0, 0, 0)!;
      const geometries = f.builder.buildChunkGeometries(chunk, f.layer)!;
      const [geometry] = [...geometries.values()];

      assert.equal(geometry.getAttribute("color"), undefined);
    }
  });

  it("emits identical geometry for an opaque and a translucent layer", () => {
    const opaque = makeFixture();
    opaque.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    const translucent = makeFixture();
    translucent.layer.opacity = 0.25;
    translucent.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });

    const [a] = [...opaque.builder.buildChunkGeometries(
      opaque.layer.getChunk(0, 0, 0)!, opaque.layer
    )!.values()];
    const [b] = [...translucent.builder.buildChunkGeometries(
      translucent.layer.getChunk(0, 0, 0)!, translucent.layer
    )!.values()];

    assert.deepEqual(a.getAttribute("position").array, b.getAttribute("position").array);
    assert.deepEqual(a.getAttribute("uv").array, b.getAttribute("uv").array);
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

describe("VoxelMeshBuilder — geometry attribute layout", () => {
  it("keeps position in float32 and narrows the rest", () => {
    const f = makeFixture();
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    const chunk = f.layer.getChunk(0, 0, 0)!;
    const geometry = [...f.builder.buildChunkGeometries(chunk, f.layer)!.values()][0];

    assert.ok(geometry.getAttribute("position").array instanceof Float32Array);

    const normals = geometry.getAttribute("normal");
    assert.ok(normals.array instanceof Int8Array);
    assert.equal(normals.normalized, true);
    assert.equal(normals.itemSize, 3);

    const uvs = geometry.getAttribute("uv");
    assert.ok(uvs.array instanceof Uint16Array);
    assert.equal(uvs.normalized, true);
    assert.equal(uvs.itemSize, 2);

    // Layer opacity rides on the material, so there is no color attribute.
    assert.equal(geometry.getAttribute("color"), undefined);
  });

  it("round-trips axis-aligned normals exactly", () => {
    const f = makeFixture();
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    const chunk = f.layer.getChunk(0, 0, 0)!;
    const geometry = [...f.builder.buildChunkGeometries(chunk, f.layer)!.values()][0];
    const normals = geometry.getAttribute("normal");

    // A cube's six faces only ever point down an axis, so every component
    // decodes back to exactly -1, 0 or 1.
    for (let i = 0; i < normals.count; i++) {
      for (const component of [normals.getX(i), normals.getY(i), normals.getZ(i)]) {
        assert.ok(
          component === -1 || component === 0 || component === 1,
          `component ${component} at vertex ${i}`
        );
      }
    }
  });

  it("keeps uv within one 16-bit step of the atlas rect", () => {
    const f = makeFixture();
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    const chunk = f.layer.getChunk(0, 0, 0)!;
    const geometry = [...f.builder.buildChunkGeometries(chunk, f.layer)!.values()][0];
    const uvs = geometry.getAttribute("uv");

    // Every vertex of a cube sits on a corner of its tile's atlas rect.
    const region = f.tilesetManager.getTileUV(kDefaultTexture);
    const step = 1 / 65535;

    for (let i = 0; i < uvs.count; i++) {
      const u = uvs.getX(i);
      const v = uvs.getY(i);
      const nearestU = u < region.offsetU + (region.scaleU / 2) ?
        region.offsetU :
        region.offsetU + region.scaleU;
      const nearestV = v < region.offsetV + (region.scaleV / 2) ?
        region.offsetV :
        region.offsetV + region.scaleV;

      assert.ok(Math.abs(u - nearestU) <= step, `u ${u} at vertex ${i}`);
      assert.ok(Math.abs(v - nearestV) <= step, `v ${v} at vertex ${i}`);
    }
  });

  it("indexes a small chunk with 16-bit values", () => {
    const f = makeFixture();
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    const chunk = f.layer.getChunk(0, 0, 0)!;
    const geometry = [...f.builder.buildChunkGeometries(chunk, f.layer)!.values()][0];

    // 6 quads → 12 triangles.
    assert.ok(geometry.getIndex()!.array instanceof Uint16Array);
    assert.equal(geometry.getIndex()!.count, 36);
  });
});

describe("VoxelMeshBuilder — buffers are reused between chunks", () => {
  it("a second chunk's geometry contains only its own faces", () => {
    const f = makeFixture();
    // chunkSize is 4, so these land in chunk (0,0,0) and chunk (1,0,0).
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    f.world.setVoxelAt("test", { x: 4, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });

    const first = f.builder.buildChunkGeometries(f.layer.getChunk(0, 0, 0)!, f.layer)!;
    const second = f.builder.buildChunkGeometries(f.layer.getChunk(1, 0, 0)!, f.layer)!;

    for (const geometries of [first, second]) {
      const geometry = [...geometries.values()][0];
      assert.equal(geometry.getAttribute("position").count, 24);
      assert.equal(geometry.getIndex()!.count, 36);
    }

    // The isolated cubes must not have been merged into a shared buffer.
    const positions = [...second.values()][0].getAttribute("position");
    assert.equal(positions.getX(0), 5);
  });
});

describe("VoxelMeshBuilder — precompiled geometry follows registry changes", () => {
  it("picks up a block definition registered after a first build", () => {
    const f = makeFixture();
    const unknownId = 99;
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: unknownId, transform: 0 });
    const chunk = f.layer.getChunk(0, 0, 0)!;

    assert.equal(f.builder.buildChunkGeometries(chunk, f.layer), null);

    f.blockRegistry.register({
      id: unknownId,
      name: "Late",
      shapeId: "cube",
      faceTextures: {},
      defaultTexture: kDefaultTexture,
      collidable: true
    });

    assert.equal(countVertices(f), 24);
  });

  it("recomputes UVs when a tileset is re-registered with a new tile size", () => {
    const f = makeFixture();
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    const chunk = f.layer.getChunk(0, 0, 0)!;

    const before = [...f.builder.buildChunkGeometries(chunk, f.layer)!.values()][0]
      .getAttribute("uv").getX(1);

    f.tilesetManager.registerTexture(
      { id: "atlas", src: "/atlas.png", tileSize: 8, cols: 4, rows: 4 },
      mockTexture()
    );

    const after = [...f.builder.buildChunkGeometries(chunk, f.layer)!.values()][0]
      .getAttribute("uv").getX(1);

    assert.notEqual(before, after);
  });
});

describe("VoxelMeshBuilder — build statistics", () => {
  it("counts the voxels, faces and geometry of an isolated cube", () => {
    const f = makeFixture();
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    const chunk = f.layer.getChunk(0, 0, 0)!;

    f.builder.buildChunkGeometries(chunk, f.layer);
    const { stats } = f.builder;

    assert.equal(stats.voxels, 1);
    assert.equal(stats.hiddenVoxels, 0);
    assert.equal(stats.faces, 6);
    assert.equal(stats.culledFaces, 0);
    assert.equal(stats.vertices, 24);
    assert.equal(stats.triangles, 12);
    assert.equal(stats.geometries, 1);
    assert.ok(stats.buildTimeMs >= 0);
  });

  it("counts the faces hidden by an opaque neighbour", () => {
    const f = makeFixture();
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    f.world.setVoxelAt("test", { x: 1, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    const chunk = f.layer.getChunk(0, 0, 0)!;

    f.builder.buildChunkGeometries(chunk, f.layer);
    const { stats } = f.builder;

    assert.equal(stats.voxels, 2);
    // The two touching faces are culled, 10 of the 12 candidates remain.
    assert.equal(stats.faces, 10);
    assert.equal(stats.culledFaces, 2);
  });

  it("counts voxels covered by a higher-priority layer as hidden", () => {
    const f = makeFixture();
    const top = f.world.addLayer("top");
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    top.setVoxelAt({ x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });

    f.builder.buildChunkGeometries(f.layer.getChunk(0, 0, 0)!, f.layer);
    const { stats } = f.builder;

    assert.equal(stats.voxels, 1);
    assert.equal(stats.hiddenVoxels, 1);
    assert.equal(stats.faces, 0);
  });

  it("resets the counters when a chunk emits nothing", () => {
    const f = makeFixture();
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    const chunk = f.layer.getChunk(0, 0, 0)!;
    f.builder.buildChunkGeometries(chunk, f.layer);

    const empty = f.layer.getOrCreateChunk(2, 0, 0);
    assert.equal(f.builder.buildChunkGeometries(empty, f.layer), null);

    assert.equal(f.builder.stats.faces, 0);
    assert.equal(f.builder.stats.vertices, 0);
  });
});

describe("VoxelMeshBuilder — derived stats", () => {
  it("reports faces per solid voxel", () => {
    const f = makeFixture();
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    f.builder.buildChunkGeometries(f.layer.getChunk(0, 0, 0)!, f.layer);

    // One isolated cube: six visible faces, one solid voxel.
    assert.equal(f.builder.stats.voxels, 1);
    assert.equal(f.builder.stats.hiddenVoxels, 0);
    assert.equal(f.builder.stats.facesPerSolidVoxel, 6);
  });

  it("reports 0 faces per solid voxel when nothing is solid", () => {
    const f = makeFixture();

    assert.equal(f.builder.stats.facesPerSolidVoxel, 0);
  });

  it("reports the emitted vertex size in bytes", () => {
    const f = makeFixture();
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    f.builder.buildChunkGeometries(f.layer.getChunk(0, 0, 0)!, f.layer);

    // position 3×f32 + normal 3×i8 + uv 2×u16.
    assert.equal(f.builder.stats.bytesPerVertex, 12 + 3 + 4);
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
    assert.equal(countVertices(f), 24);

    // World x=1 is adjacent, but the offset puts it in the shifted layer's
    // chunk (-1,0,0) — a different grid cell than the chunk being meshed.
    shifted.setVoxelAt({ x: 1, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });

    assert.equal(countVertices(f), 20);
  });

  it("culls a face against a neighbour one chunk over", () => {
    const f = makeFixture();
    // chunkSize is 4: x=3 is the last column of chunk 0, x=4 the first of chunk 1.
    f.world.setVoxelAt("test", { x: 3, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    f.world.setVoxelAt("test", { x: 4, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });

    const chunk = f.layer.getChunk(0, 0, 0)!;
    f.builder.buildChunkGeometries(chunk, f.layer);

    assert.equal(f.builder.stats.culledFaces, 1);
    assert.equal(f.builder.stats.faces, 5);
  });

  it("culls a face against a neighbour one chunk below on the negative side", () => {
    const f = makeFixture();
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    f.world.setVoxelAt("test", { x: -1, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });

    const chunk = f.layer.getChunk(0, 0, 0)!;
    f.builder.buildChunkGeometries(chunk, f.layer);

    assert.equal(f.builder.stats.culledFaces, 1);
    assert.equal(f.builder.stats.faces, 5);
  });
});
