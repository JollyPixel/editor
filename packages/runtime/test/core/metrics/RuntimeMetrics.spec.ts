// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Third-party Dependencies
import {
  StatsRecorder,
  type MetricSource
} from "@jolly-pixel/ui/stats";

// Import Internal Dependencies
import { RuntimeMetrics } from "../../../src/core/metrics/RuntimeMetrics.ts";

function createMetrics() {
  const recorder = new StatsRecorder();
  const renderer: MetricSource = {
    metrics: [
      {
        id: "calls",
        label: "draw calls",
        sample: () => 0
      }
    ]
  };
  const metrics = new RuntimeMetrics(recorder, renderer);

  return { recorder, metrics };
}

describe("RuntimeMetrics", () => {
  it("registers the renderer source on the recorder", () => {
    const { recorder } = createMetrics();
    const ids = recorder.definitions.map(({ id }) => id);

    assert.ok(ids.includes("calls"));
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

  it("unmounts the panel when its signal aborts", async() => {
    const { metrics } = createMetrics();
    const host = document.createElement("div");
    const controller = new AbortController();

    await metrics.mountPanel({
      target: host,
      signal: controller.signal
    });
    controller.abort();

    assert.equal(metrics.panel, null);
    assert.equal(host.childElementCount, 0);
  });

  it("skips a mount aborted before it resolves and keeps the current panel", async() => {
    const { metrics } = createMetrics();
    const host = document.createElement("div");
    const current = await metrics.mountPanel({ target: host });
    const controller = new AbortController();

    const mounting = metrics.mountPanel({
      target: host,
      signal: controller.signal
    });
    controller.abort();
    await mounting;

    assert.strictEqual(metrics.panel, current);
    assert.equal(host.childElementCount, 1);
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

  it("dispose removes the panel", async() => {
    const { metrics } = createMetrics();
    const host = document.createElement("div");
    await metrics.mountPanel({ target: host });

    metrics.dispose();

    assert.strictEqual(metrics.panel, null);
    assert.equal(host.childElementCount, 0);
  });
});
