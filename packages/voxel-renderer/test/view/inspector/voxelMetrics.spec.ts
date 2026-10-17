// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { voxelMetrics } from "../../../src/view/inspector/voxelMetrics.ts";
import type {
  VoxelMeshInspector,
  VoxelMeshStats
} from "../../../src/view/inspector/index.ts";
import type { VoxelMetric } from "../../../src/view/inspector/VoxelMetric.ts";

function createInspector(
  stats: Partial<VoxelMeshStats>
): VoxelMeshInspector {
  return {
    stats: {
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
      buildTimeMs: 0,
      ...stats
    }
  };
}

function readSample(
  metrics: readonly VoxelMetric[],
  id: string
): number {
  const metric = metrics.find((candidate) => candidate.id === id);
  assert.ok(metric, `no metric named ${id}`);

  return metric.sample();
}

describe("voxelMetrics", () => {
  it("samples the live statistics rather than a copy", () => {
    const inspector = createInspector({ voxels: 2 });
    const metrics = voxelMetrics(inspector);

    assert.equal(readSample(metrics, "voxels"), 2);
    inspector.stats.voxels = 9;
    assert.equal(readSample(metrics, "voxels"), 9);
  });

  it("reports culled faces as a share of every candidate face", () => {
    const metrics = voxelMetrics(
      createInspector({ faces: 3, culledFaces: 1 })
    );

    assert.equal(readSample(metrics, "culledFaces"), 25);
  });

  it("reports a zero share when nothing was built", () => {
    const metrics = voxelMetrics(createInspector({}));

    assert.equal(readSample(metrics, "culledFaces"), 0);
  });

  it("names every metric once", () => {
    const metrics = voxelMetrics(createInspector({}));
    const ids = new Set(metrics.map(({ id }) => id));

    assert.equal(ids.size, metrics.length);
  });
});
