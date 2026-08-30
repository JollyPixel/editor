// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import { VoxelWorld } from "../../src/world/VoxelWorld.ts";
import { BlockRegistry } from "../../src/blocks/BlockRegistry.ts";
import { BlockShapeRegistry } from "../../src/blocks/BlockShapeRegistry.ts";
import { TilesetManager } from "../../src/tileset/TilesetManager.ts";
import { VoxelMeshBuilder } from "../../src/mesh/index.ts";
import { packTransform } from "../../src/utils/math.ts";
import type { VoxelChunk } from "../../src/world/VoxelChunk.ts";
import { mockTexture } from "../helpers/mockTexture.ts";
import { DEFAULT_TEXTURE, makeBlockDef } from "../helpers/blocks.ts";
import { makeAtlasDef } from "../helpers/atlas.ts";

// CONSTANTS
const kCubeId = 1;
const kRampId = 2;
const kStairId = 3;
const kLeavesId = 4;

/**
 * Builds a fully functional (non-rendering) fixture: world (chunkSize=4),
 * block registry with cube / ramp / stair, default shape registry, and a
 * TilesetManager with a dummy atlas registered so UV lookup succeeds.
 */
function makeFixture() {
  const world = new VoxelWorld(4);
  const layer = world.addLayer("test");

  const blockRegistry = new BlockRegistry([
    makeBlockDef(kCubeId, "cube", { name: "Cube" }),
    makeBlockDef(kRampId, "ramp", { name: "Ramp" }),
    makeBlockDef(kStairId, "stair", { name: "Stair" })
  ]);

  const shapeRegistry = BlockShapeRegistry.createDefault();

  const tilesetManager = new TilesetManager();
  tilesetManager.registerTexture(makeAtlasDef(), mockTexture());

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

/** Fetches the chunk at `chunkCoords`, asserting it exists. */
function getChunk(
  fixture: ReturnType<typeof makeFixture>,
  chunkCoords: [number, number, number] = [0, 0, 0]
): VoxelChunk {
  const chunk = fixture.layer.getChunk(...chunkCoords);
  assert.ok(chunk);

  return chunk;
}

/**
 * Builds the chunk at `chunkCoords`, asserting it produced geometries. Most
 * tests below have a visible voxel and expect a non-null result; the few that
 * exercise the null path (empty/hidden/unregistered) call the builder
 * directly instead of going through this helper.
 */
function buildGeometries(
  fixture: ReturnType<typeof makeFixture>,
  chunkCoords: [number, number, number] = [0, 0, 0]
): Map<string, THREE.BufferGeometry> {
  const geometries = fixture.builder.buildChunkGeometries(getChunk(fixture, chunkCoords), fixture.layer);
  assert.ok(geometries);

  return geometries;
}

/** Same as `buildGeometries`, narrowed to the single geometry callers expect. */
function firstGeometry(
  fixture: ReturnType<typeof makeFixture>,
  chunkCoords: [number, number, number] = [0, 0, 0]
): THREE.BufferGeometry {
  const [geometry] = [...buildGeometries(fixture, chunkCoords).values()];

  return geometry;
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

describe("VoxelMeshBuilder — transparent blocks never occlude", () => {
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
    assert.equal(countVertices(f), 44);
  });

  it("culls that face when the same block is not flagged transparent", () => {
    const f = withLeaves(false);
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    f.world.setVoxelAt("test", { x: 1, y: 0, z: 0 }, { blockId: kLeavesId, transform: 0 });

    // 5 faces each: the cube's face is dropped and the holes look into nothing.
    assert.equal(countVertices(f), 40);
  });

  it("keeps every face between two transparent neighbours", () => {
    const f = withLeaves(true);
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kLeavesId, transform: 0 });
    f.world.setVoxelAt("test", { x: 1, y: 0, z: 0 }, { blockId: kLeavesId, transform: 0 });

    // The canopy case: 6 faces each, nothing culled.
    assert.equal(countVertices(f), 48);
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

describe("VoxelMeshBuilder — layer opacity is not a vertex attribute", () => {
  it("emits no color attribute, whatever the layer opacity", () => {
    for (const opacity of [1, 0.25]) {
      const f = makeFixture();
      f.layer.opacity = opacity;
      f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
      const [geometry] = [...buildGeometries(f).values()];

      assert.equal(geometry.getAttribute("color"), undefined);
    }
  });

  it("emits identical geometry for an opaque and a translucent layer", () => {
    const opaque = makeFixture();
    opaque.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    const translucent = makeFixture();
    translucent.layer.opacity = 0.25;
    translucent.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });

    const [a] = [...buildGeometries(opaque).values()];
    const [b] = [...buildGeometries(translucent).values()];

    assert.deepEqual(a.getAttribute("position").array, b.getAttribute("position").array);
    assert.deepEqual(a.getAttribute("uv").array, b.getAttribute("uv").array);
  });
});

describe("VoxelMeshBuilder — ramp rotation base cases (rot=0, rot=2)", () => {
  it("ramp back wall (PosZ) adjacent to cube NegZ: cube NegZ face is hidden", () => {
    // rot=2 (180°) turns the ramp's back wall to face world NegZ, so placing
    // the ramp at (0,0,1) puts that wall against the cube's PosZ face.
    const f = makeFixture();
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 1 }, {
      blockId: kRampId,
      transform: packTransform(2, false, false)
    });

    // Cube: 5 faces (PosZ hidden by the ramp's back wall) = 20 verts.
    // Ramp(rot=2): 14 verts — NegY, NegX, PosX and the slope; the back wall
    // is culled against the cube.
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

    // The ramp's open front (rot=0) has no NegZ geometry, so it never
    // occludes the cube's PosZ face: 24 cube verts + 18 ramp verts = 42.
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

    // Cube keeps all 6 faces (24 verts); the ramp's open front (rot=1) faces
    // away from the cube, so none of its 5 faces are culled either (18 verts).
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

    // Cube's PosX face is hidden by the ramp's back wall (rot=3 turns it to
    // face NegX): 20 cube verts + the ramp's remaining 14 = 34.
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

    // Cube keeps all 6 faces (24 verts). Of the stair's 10 constituent faces,
    // 9 are emitted at 4 verts each (36 verts) — the tenth is culled where it
    // meets the cube.
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
    const geometry = firstGeometry(f);

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
    const geometry = firstGeometry(f);
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
    const geometry = firstGeometry(f);
    const uvs = geometry.getAttribute("uv");

    // Every vertex of a cube sits on a corner of its tile's atlas rect.
    const region = f.tilesetManager.getTileUV(DEFAULT_TEXTURE);
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
    const geometry = firstGeometry(f);
    const index = geometry.getIndex();
    assert.ok(index);

    // 6 quads → 12 triangles.
    assert.ok(index.array instanceof Uint16Array);
    assert.equal(index.count, 36);
  });
});

describe("VoxelMeshBuilder — greedy toggle", () => {
  it("defaults to off", () => {
    assert.equal(makeFixture().builder.greedy, false);
  });

  it("switches meshing mode at runtime", () => {
    const f = makeFixture();
    for (let x = 0; x <= 3; x++) {
      for (let z = 0; z <= 3; z++) {
        f.world.setVoxelAt("test", { x, y: 0, z }, { blockId: kCubeId, transform: 0 });
      }
    }
    assert.equal(countVertices(f), 48 * 4);

    f.builder.greedy = true;
    assert.equal(countVertices(f), 6 * 4);

    f.builder.greedy = false;
    assert.equal(countVertices(f), 48 * 4);
  });
});

describe("VoxelMeshBuilder — buffers are reused between chunks", () => {
  it("a second chunk's geometry contains only its own faces", () => {
    const f = makeFixture();
    // chunkSize is 4, so these land in chunk (0,0,0) and chunk (1,0,0).
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    f.world.setVoxelAt("test", { x: 4, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });

    const first = buildGeometries(f, [0, 0, 0]);
    const second = buildGeometries(f, [1, 0, 0]);

    for (const geometries of [first, second]) {
      const geometry = [...geometries.values()][0];
      const index = geometry.getIndex();
      assert.ok(index);

      assert.equal(geometry.getAttribute("position").count, 24);
      assert.equal(index.count, 36);
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
    const chunk = getChunk(f);

    assert.equal(f.builder.buildChunkGeometries(chunk, f.layer), null);

    f.blockRegistry.register(makeBlockDef(unknownId, "cube", { name: "Late" }));

    assert.equal(countVertices(f), 24);
  });

  it("recomputes UVs when a tileset is re-registered with a new tile size", () => {
    const f = makeFixture();
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });

    const before = firstGeometry(f).getAttribute("uv").getX(1);

    f.tilesetManager.registerTexture(makeAtlasDef({ tileSize: 8 }), mockTexture());

    const after = firstGeometry(f).getAttribute("uv").getX(1);

    assert.notEqual(before, after);
  });
});

describe("VoxelMeshBuilder — build statistics", () => {
  it("counts the voxels, faces and geometry of an isolated cube", () => {
    const f = makeFixture();
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });

    buildGeometries(f);
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

    buildGeometries(f);
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

    const chunk = getChunk(f);
    f.builder.buildChunkGeometries(chunk, f.layer);
    const { stats } = f.builder;

    assert.equal(stats.voxels, 1);
    assert.equal(stats.hiddenVoxels, 1);
    assert.equal(stats.faces, 0);
  });

  it("resets the counters when a chunk emits nothing", () => {
    const f = makeFixture();
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });
    buildGeometries(f);

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
    buildGeometries(f);

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
    buildGeometries(f);

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
