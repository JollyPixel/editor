// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Third-party Dependencies
import type * as THREE from "three/webgpu";

// Import Internal Dependencies
import { RendererMetrics } from "../../src/metrics/RendererMetrics.ts";

interface FakeRenderer {
  info: {
    render: { drawCalls: number; triangles: number; };
    memory: { geometries: number; textures: number; };
  };
}

function makeRenderer(): FakeRenderer {
  return {
    info: {
      render: {
        drawCalls: 12,
        triangles: 300
      },
      memory: {
        geometries: 4,
        textures: 2
      }
    }
  };
}

function sampleOf(
  metrics: RendererMetrics,
  id: string
): number {
  const metric = metrics.metrics.find((candidate) => candidate.id === id);
  assert.ok(metric?.sample, `no sampled metric named ${id}`);

  return metric.sample();
}

function metricsOf(
  renderer: FakeRenderer
): RendererMetrics {
  return new RendererMetrics(renderer as unknown as THREE.WebGPURenderer);
}

describe("RendererMetrics", () => {
  it("reads the live counters until a frame is captured", () => {
    const renderer = makeRenderer();
    const metrics = metricsOf(renderer);

    assert.equal(sampleOf(metrics, "calls"), 12);
    assert.equal(sampleOf(metrics, "renderedTriangles"), 300);
  });

  it("holds the captured frame after the renderer resets its counters", () => {
    const renderer = makeRenderer();
    const metrics = metricsOf(renderer);

    metrics.captureFrame();
    renderer.info.render.drawCalls = 0;
    renderer.info.render.triangles = 0;

    assert.equal(sampleOf(metrics, "calls"), 12);
    assert.equal(sampleOf(metrics, "renderedTriangles"), 300);
  });

  it("reads memory counters live, which the renderer never resets", () => {
    const renderer = makeRenderer();
    const metrics = metricsOf(renderer);

    renderer.info.memory.geometries = 9;
    assert.equal(sampleOf(metrics, "geometries"), 9);
    assert.equal(sampleOf(metrics, "textures"), 2);
  });

  it("files every metric under one group, outside the tile", () => {
    const metrics = metricsOf(makeRenderer());

    for (const metric of metrics.metrics) {
      assert.equal(metric.group, "renderer");
      assert.equal(metric.tile, false);
      assert.equal(metric.unit, "count");
    }
  });

  it("takes the group and the tile from its options", () => {
    const metrics = new RendererMetrics(
      makeRenderer() as unknown as THREE.WebGPURenderer,
      {
        group: "gpu",
        tile: true
      }
    );

    for (const metric of metrics.metrics) {
      assert.equal(metric.group, "gpu");
      assert.equal(metric.tile, true);
    }
  });
});
