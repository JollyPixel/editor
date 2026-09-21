// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { voxelMetrics } from "../../src/inspector/voxelMetrics.ts";
import type {
  VoxelMeshInspector,
  VoxelMeshStats
} from "../../src/inspector/index.ts";
import type { VoxelMetric } from "../../src/inspector/VoxelMetric.ts";

function inspectorOf(
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
      mergedFaces: 0,
      vertices: 0,
      triangles: 0,
      facesPerSolidVoxel: 0,
      bytesPerVertex: 0,
      buildTimeMs: 0,
      ...stats
    }
  };
}

function sampleOf(
  metrics: readonly VoxelMetric[],
  id: string
): number {
  const metric = metrics.find((candidate) => candidate.id === id);
  assert.ok(metric, `no metric named ${id}`);

  return metric.sample();
}

describe("voxelMetrics", () => {
  it("samples the live statistics rather than a copy", () => {
    const inspector = inspectorOf({ voxels: 2 });
    const metrics = voxelMetrics(inspector);

    assert.equal(sampleOf(metrics, "voxels"), 2);
    inspector.stats.voxels = 9;
    assert.equal(sampleOf(metrics, "voxels"), 9);
  });

  it("reports culled faces as a share of every candidate face", () => {
    const metrics = voxelMetrics(
      inspectorOf({ faces: 3, culledFaces: 1 })
    );

    assert.equal(sampleOf(metrics, "culledFaces"), 25);
  });

  it("reports merged faces as a share of every emitted face", () => {
    const metrics = voxelMetrics(
      inspectorOf({ faces: 1, mergedFaces: 3 })
    );

    assert.equal(sampleOf(metrics, "mergedFaces"), 75);
  });

  it("reports a zero share when nothing was built", () => {
    const metrics = voxelMetrics(inspectorOf({}));

    assert.equal(sampleOf(metrics, "culledFaces"), 0);
    assert.equal(sampleOf(metrics, "mergedFaces"), 0);
  });

  it("names every metric once", () => {
    const metrics = voxelMetrics(inspectorOf({}));
    const ids = new Set(metrics.map(({ id }) => id));

    assert.equal(ids.size, metrics.length);
  });
});
