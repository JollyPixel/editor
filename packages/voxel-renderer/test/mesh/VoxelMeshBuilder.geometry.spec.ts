// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { DEFAULT_TEXTURE, makeBlockDef } from "../helpers/blocks.ts";
import {
  buildGeometries,
  countChunkVertices,
  fillBox,
  firstGeometry,
  getChunk,
  makeMeshFixture,
  place
} from "../helpers/meshFixture.ts";
import { RAMP_ID as kRampId } from "../helpers/ids.ts";
import type { BlockDefinition } from "../../src/blocks/index.ts";

describe("VoxelMeshBuilder - isolated cube", () => {
  it("emits all 6 faces (24 vertices) when no neighbours exist", () => {
    const fixture = makeMeshFixture();
    place(fixture, [0, 0, 0]);

    assert.equal(countChunkVertices(fixture), 24);
  });

  it("returns null when no blocks are placed", () => {
    const fixture = makeMeshFixture();
    const chunk = fixture.layer.getOrCreateChunk(0, 0, 0);

    assert.equal(fixture.builder.buildChunkGeometries(chunk, fixture.layer), null);
  });

  it("emits identical geometry for an opaque and a translucent layer", () => {
    const opaque = makeMeshFixture();
    const translucent = makeMeshFixture();
    translucent.layer.opacity = 0.25;
    for (const fixture of [opaque, translucent]) {
      place(fixture, [0, 0, 0]);
    }

    const a = firstGeometry(opaque);
    const b = firstGeometry(translucent);

    assert.deepEqual(a.getAttribute("position").array, b.getAttribute("position").array);
    assert.deepEqual(a.getAttribute("uv").array, b.getAttribute("uv").array);
  });
});

describe("VoxelMeshBuilder - geometry attribute layout", () => {
  it("keeps position in float32, narrows the rest and emits no color", () => {
    const fixture = makeMeshFixture();
    place(fixture, [0, 0, 0]);
    const geometry = firstGeometry(fixture);

    assert.ok(geometry.getAttribute("position").array instanceof Float32Array);

    const normals = geometry.getAttribute("normal");
    assert.ok(normals.array instanceof Int8Array);
    assert.equal(normals.normalized, true);
    assert.equal(normals.itemSize, 4);

    const uvs = geometry.getAttribute("uv");
    assert.ok(uvs.array instanceof Uint16Array);
    assert.equal(uvs.normalized, true);
    assert.equal(uvs.itemSize, 2);

    assert.equal(geometry.getAttribute("color"), undefined);
  });

  it("round-trips axis-aligned normals exactly", () => {
    const fixture = makeMeshFixture();
    place(fixture, [0, 0, 0]);
    const normals = firstGeometry(fixture).getAttribute("normal");

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
    const fixture = makeMeshFixture();
    place(fixture, [0, 0, 0]);
    const uvs = firstGeometry(fixture).getAttribute("uv");

    const region = fixture.tilesetManager.atlas().uvFor(DEFAULT_TEXTURE.col, DEFAULT_TEXTURE.row);
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

  it("samples a ramp slope over its true length only when it owns a tile", () => {
    const step = 1 / 65535;
    const atlas = makeMeshFixture().tilesetManager.atlas();

    const shared = rampSlopeVs(makeBlockDef(10, "ramp"));
    const square = atlas.uvFor(0, 0);
    assert.ok(Math.abs(Math.min(...shared) - square.offsetV) <= step);

    const owned = rampSlopeVs(makeBlockDef(10, "ramp", {
      faceTextures: { top: { col: 1, row: 0 } }
    }));
    const tall = atlas.uvFor(1, 0, undefined, { u: 1, v: Math.SQRT2 });
    assert.ok(Math.abs(Math.min(...owned) - tall.offsetV) <= step);
    assert.ok(
      Math.abs(Math.max(...owned) - (tall.offsetV + tall.scaleV)) <= step
    );
  });

  it("pads a triangle into a quad whose second half is degenerate", () => {
    const fixture = makeMeshFixture();
    place(fixture, [0, 0, 0], kRampId);
    const positions = firstGeometry(fixture).getAttribute("position");
    const quads = positions.count / 4;
    let padded = 0;

    for (let quad = 0; quad < quads; quad++) {
      const third = (quad * 4) + 2;
      const fourth = third + 1;
      if (
        positions.getX(third) === positions.getX(fourth) &&
        positions.getY(third) === positions.getY(fourth) &&
        positions.getZ(third) === positions.getZ(fourth)
      ) {
        padded++;
      }
    }

    assert.equal(padded, 2);
    assert.equal(fixture.builder.stats.triangles, (quads * 2) - padded);
  });
});

describe("VoxelMeshBuilder - greedy toggle", () => {
  it("is off by default and switches meshing mode at runtime", () => {
    const fixture = makeMeshFixture();
    fillBox(fixture, { from: [0, 0, 0], to: [3, 0, 3] });
    assert.equal(fixture.builder.greedy, false);
    const naive = countChunkVertices(fixture);

    fixture.builder.greedy = true;
    assert.ok(countChunkVertices(fixture) < naive);

    fixture.builder.greedy = false;
    assert.equal(countChunkVertices(fixture), naive);
  });
});

describe("VoxelMeshBuilder - buffers are reused between chunks", () => {
  it("builds each chunk with only its own faces, in chunk-local space", () => {
    const fixture = makeMeshFixture();
    place(fixture, [0, 0, 0]);
    place(fixture, [4, 0, 0]);

    const first = firstGeometry(fixture, [0, 0, 0]);
    const second = firstGeometry(fixture, [1, 0, 0]);

    for (const geometry of [first, second]) {
      geometry.computeBoundingBox();
      assert.equal(geometry.getAttribute("position").count, 24);
      assert.equal(geometry.drawRange.count, 36);
      assert.deepEqual(geometry.boundingBox!.min.toArray(), [0, 0, 0]);
      assert.deepEqual(geometry.boundingBox!.max.toArray(), [1, 1, 1]);
    }
  });
});

describe("VoxelMeshBuilder - precompiled geometry follows registry changes", () => {
  it("picks up a block definition registered after a first build", () => {
    const fixture = makeMeshFixture();
    const unknownId = 99;
    place(fixture, [0, 0, 0], unknownId);

    assert.equal(fixture.builder.buildChunkGeometries(getChunk(fixture), fixture.layer), null);

    fixture.blockRegistry.register(makeBlockDef(unknownId, "cube"));

    assert.equal(countChunkVertices(fixture), 24);
  });

  it("recomputes UVs when a tileset is resized", () => {
    const fixture = makeMeshFixture();
    place(fixture, [0, 0, 0]);
    const before = firstGeometry(fixture).getAttribute("uv").getX(1);

    fixture.tilesetManager.tilesets.resize("atlas", 8);
    fixture.tilesetManager.syncAtlases();

    assert.notEqual(firstGeometry(fixture).getAttribute("uv").getX(1), before);
  });
});

describe("VoxelMeshBuilder - build statistics", () => {
  it("counts the voxels, faces and geometry of an isolated cube", () => {
    const fixture = makeMeshFixture();
    place(fixture, [0, 0, 0]);

    buildGeometries(fixture);

    assert.deepEqual(
      { ...fixture.builder.stats, buildTimeMs: 0 },
      {
        voxels: 1,
        hiddenVoxels: 0,
        faces: 6,
        culledFaces: 0,
        mergedFaces: 0,
        vertices: 24,
        triangles: 12,
        geometries: 1,
        bytesPerVertex: 12 + 4 + 4 + 8,
        buildTimeMs: 0
      }
    );
    assert.equal(fixture.builder.stats.facesPerSolidVoxel, 6);
  });

  it("counts the faces hidden by an opaque neighbour", () => {
    const fixture = makeMeshFixture();
    place(fixture, [0, 0, 0]);
    place(fixture, [1, 0, 0]);

    buildGeometries(fixture);

    assert.equal(fixture.builder.stats.voxels, 2);
    assert.equal(fixture.builder.stats.faces, 10);
    assert.equal(fixture.builder.stats.culledFaces, 2);
  });

  it("counts voxels covered by a higher-priority layer as hidden", () => {
    const fixture = makeMeshFixture();
    place(fixture, [0, 0, 0]);
    place(fixture.world.addLayer("top"), [0, 0, 0]);

    fixture.builder.buildChunkGeometries(getChunk(fixture), fixture.layer);

    assert.equal(fixture.builder.stats.voxels, 1);
    assert.equal(fixture.builder.stats.hiddenVoxels, 1);
    assert.equal(fixture.builder.stats.faces, 0);
  });

  it("resets the counters when a chunk emits nothing", () => {
    const fixture = makeMeshFixture();
    place(fixture, [0, 0, 0]);
    buildGeometries(fixture);

    const empty = fixture.layer.getOrCreateChunk(2, 0, 0);
    assert.equal(fixture.builder.buildChunkGeometries(empty, fixture.layer), null);

    assert.equal(fixture.builder.stats.faces, 0);
    assert.equal(fixture.builder.stats.vertices, 0);
    assert.equal(fixture.builder.stats.facesPerSolidVoxel, 0);
  });
});

function rampSlopeVs(
  block: BlockDefinition
): number[] {
  const fixture = makeMeshFixture();
  fixture.blockRegistry.register(block);
  place(fixture, [0, 0, 0], block.id);
  const geometry = firstGeometry(fixture);
  const normals = geometry.getAttribute("normal");
  const uvs = geometry.getAttribute("uv");
  const values: number[] = [];
  for (let i = 0; i < uvs.count; i++) {
    if (normals.getY(i) > 0 && normals.getZ(i) < 0) {
      values.push(uvs.getY(i));
    }
  }

  return values;
}
