// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { DEFAULT_TEXTURE, makeBlockDef } from "../helpers/blocks.ts";
import { makeAtlasDef } from "../helpers/atlas.ts";
import { mockTexture } from "../helpers/mockTexture.ts";
import {
  buildGeometries,
  countChunkVertices,
  firstGeometry,
  getChunk,
  makeMeshFixture as makeFixture,
  CUBE_ID as kCubeId
} from "../helpers/meshFixture.ts";

describe("VoxelMeshBuilder — isolated cube", () => {
  it("emits all 6 faces (24 vertices) when no neighbours exist", () => {
    const f = makeFixture();
    f.world.setVoxelAt("test", { x: 0, y: 0, z: 0 }, { blockId: kCubeId, transform: 0 });

    // 6 quad faces × 4 vertices = 24
    assert.equal(countChunkVertices(f), 24);
  });

  it("returns null when no blocks are placed", () => {
    const f = makeFixture();
    const chunk = f.layer.getOrCreateChunk(0, 0, 0);

    assert.equal(f.builder.buildChunkGeometries(chunk, f.layer), null);
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
    const region = f.tilesetManager.atlas().uvFor(DEFAULT_TEXTURE.col, DEFAULT_TEXTURE.row);
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
    assert.equal(countChunkVertices(f), 48 * 4);

    f.builder.greedy = true;
    assert.equal(countChunkVertices(f), 6 * 4);

    f.builder.greedy = false;
    assert.equal(countChunkVertices(f), 48 * 4);
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

    assert.equal(countChunkVertices(f), 24);
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

    // position 3×f32 + normal 3×i8 + uv 2×u16 + tileRegion 4×u16.
    assert.equal(f.builder.stats.bytesPerVertex, 12 + 3 + 4 + 8);
  });
});
