// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelEngine } from "../../src/VoxelEngine.ts";
import { makeInspectorEngine } from "./VoxelInspector.helpers.ts";

describe("VoxelInspector - statistics", () => {
  it("reports nothing before any chunk is meshed", () => {
    const engine = new VoxelEngine({
      chunkSize: 4,
      layers: ["Ground"]
    });

    assert.deepEqual(engine.inspector.mesh.stats, {
      chunks: 0,
      culledChunks: 0,
      meshes: 0,
      voxels: 0,
      hiddenVoxels: 0,
      faces: 0,
      culledFaces: 0,
      mergedFaces: 0,
      vertices: 0,
      triangles: 0,
      facesPerSolidVoxel: 0,
      bytesPerVertex: 0,
      buildTimeMs: 0
    });
  });

  it("aggregates the geometry of a single meshed cube", () => {
    const engine = makeInspectorEngine();
    const stats = engine.inspector.mesh.stats;

    assert.equal(stats.chunks, 1);
    assert.equal(stats.meshes, 1);
    assert.equal(stats.voxels, 1);
    assert.equal(stats.faces, 6);
    assert.equal(stats.culledFaces, 0);
    assert.equal(stats.vertices, 24);
    assert.equal(stats.triangles, 12);
  });

  it("counts the faces culled between two adjacent cubes", () => {
    const engine = makeInspectorEngine({ voxels: 2 });
    const stats = engine.inspector.mesh.stats;

    assert.equal(stats.voxels, 2);
    assert.equal(stats.faces, 10);
    assert.equal(stats.culledFaces, 2);
  });

  it("drops the statistics of a chunk once its layer is removed", () => {
    const engine = makeInspectorEngine();
    engine.world.removeLayer("Ground");
    engine.tick(0);

    assert.equal(engine.inspector.mesh.stats.chunks, 0);
    assert.equal(engine.inspector.mesh.stats.faces, 0);
  });

  it("does not double-count a chunk rebuilt several times", () => {
    const engine = makeInspectorEngine();
    engine.markAllChunksDirty("test");
    engine.tick(0);

    assert.equal(engine.inspector.mesh.stats.chunks, 1);
    assert.equal(engine.inspector.mesh.stats.faces, 6);
  });
});
