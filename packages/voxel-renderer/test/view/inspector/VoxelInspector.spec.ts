// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  createView,
  fillChunks
} from "../../helpers/view.ts";
import { makeInspectorView } from "./VoxelInspector.helpers.ts";

describe("VoxelInspector - statistics", () => {
  it("reports nothing before any chunk is meshed", () => {
    const view = createView({
      chunkSize: 4,
      layers: ["Ground"]
    });

    assert.deepEqual(view.inspector.mesh.stats, {
      chunks: 0,
      culledChunks: 0,
      meshes: 0,
      voxels: 0,
      hiddenVoxels: 0,
      faces: 0,
      culledFaces: 0,
      vertices: 0,
      triangles: 0,
      facesPerSolidVoxel: 0,
      bytesPerVertex: 0,
      bytes: 0,
      buildTimeMs: 0
    });
  });

  it("sums the statistics of every meshed chunk", () => {
    const view = makeInspectorView();
    fillChunks(view, "Ground", 3);
    view.tick(0);
    const { stats } = view.inspector.mesh;

    assert.equal(stats.chunks, 3);
    assert.equal(stats.meshes, 3);
    assert.equal(stats.voxels, 3);
    assert.equal(stats.faces, 18);
    assert.equal(stats.vertices, 72);
    assert.equal(stats.triangles, 36);
    assert.equal(stats.facesPerSolidVoxel, 6);
    assert.equal(stats.bytesPerVertex, 2);
    assert.equal(stats.bytes, 3 * ((6 * 8) + (2 * 4 * 3 * 4) + (6 * 2)));
  });

  it("drops the statistics of a chunk once its layer is removed", () => {
    const view = makeInspectorView();
    view.document.world.removeLayer("Ground");
    view.tick(0);

    assert.equal(view.inspector.mesh.stats.chunks, 0);
    assert.equal(view.inspector.mesh.stats.faces, 0);
  });

  it("does not double-count a chunk rebuilt several times", () => {
    const view = makeInspectorView();
    view.markAllChunksDirty("test");
    view.tick(0);

    assert.equal(view.inspector.mesh.stats.chunks, 1);
    assert.equal(view.inspector.mesh.stats.faces, 6);
  });
});
