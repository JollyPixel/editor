// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Third-party Dependencies
import { StatsRecorder } from "@jolly-pixel/ui/stats";

// Import Internal Dependencies
import {
  RuntimeMetrics,
  type RuntimeMetricsRenderer
} from "../../src/metrics/RuntimeMetrics.ts";

class FakeRenderer {
  readonly info = {
    render: {
      drawCalls: 0,
      triangles: 0
    },
    memory: {
      geometries: 0,
      textures: 0,
      attributesSize: 0,
      indexAttributesSize: 0,
      texturesSize: 0
    }
  };

  #draw = new Set<() => void>();

  get listenerCount(): number {
    return this.#draw.size;
  }

  getSource() {
    return {
      info: this.info
    };
  }

  on(
    _type: "draw",
    handler: () => void
  ): this {
    this.#draw.add(handler);

    return this;
  }

  off(
    _type: "draw",
    handler: () => void
  ): this {
    this.#draw.delete(handler);

    return this;
  }

  draw(
    drawCalls: number,
    triangles: number
  ): void {
    this.info.render.drawCalls = drawCalls;
    this.info.render.triangles = triangles;
    for (const handler of this.#draw) {
      handler();
    }
  }
}

function createMetrics() {
  const recorder = new StatsRecorder();
  const renderer = new FakeRenderer();
  const metrics = new RuntimeMetrics(
    recorder,
    renderer as unknown as RuntimeMetricsRenderer
  );

  return { recorder, renderer, metrics };
}

describe("RuntimeMetrics", () => {
  it("registers the renderer counters on the recorder", () => {
    const { recorder } = createMetrics();
    const ids = recorder.definitions.map(({ id }) => id);

    assert.ok(ids.includes("calls"));
    assert.ok(ids.includes("textures"));
  });

  it("latches the renderer counters on every draw", () => {
    const { renderer, metrics } = createMetrics();

    renderer.draw(12, 300);
    renderer.info.render.drawCalls = 0;

    assert.equal(metrics.renderer.frame.drawCalls, 12);
    assert.equal(metrics.renderer.frame.triangles, 300);
  });

  it("forwards metrics and sources to the recorder", () => {
    const { recorder, metrics } = createMetrics();

    const release = metrics.addSource({
      metrics: [
        {
          id: "chunks",
          label: "chunks",
          sample: () => 1
        }
      ]
    });
    metrics.addMetric({
      id: "meshes",
      label: "meshes"
    });

    const ids = recorder.definitions.map(({ id }) => id);
    assert.ok(ids.includes("chunks"));
    assert.ok(ids.includes("meshes"));

    release();
    assert.equal(metrics.removeMetric("meshes"), true);
    assert.deepEqual(
      recorder.definitions.filter(({ id }) => id === "chunks" || id === "meshes"),
      []
    );
  });

  it("keeps one panel, replacing it on every mount", async() => {
    const { metrics } = createMetrics();
    const host = document.createElement("div");

    const first = await metrics.mountPanel({ target: host });
    const second = await metrics.mountPanel({ target: host });

    assert.strictEqual(metrics.panel, second);
    assert.notStrictEqual(first, second);
    assert.equal(host.childElementCount, 1);

    metrics.dispose();
  });

  it("dispose stops latching and removes the panel", async() => {
    const { renderer, metrics } = createMetrics();
    const host = document.createElement("div");
    await metrics.mountPanel({ target: host });

    metrics.dispose();

    assert.equal(renderer.listenerCount, 0);
    assert.strictEqual(metrics.panel, null);
    assert.equal(host.childElementCount, 0);
  });
});
