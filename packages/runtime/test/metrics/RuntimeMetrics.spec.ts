// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Third-party Dependencies
import { StatsRecorder } from "@jolly-pixel/ui/stats";
import {
  GameLoop,
  ManualFrameSource
} from "@jolly-pixel/loop";

// Import Internal Dependencies
import { RuntimeMetrics } from "../../src/metrics/RuntimeMetrics.ts";
import { OverlayLayer } from "../../src/overlay/OverlayLayer.ts";

function createMetrics() {
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const recorder = new StatsRecorder();
  const overlay = new OverlayLayer(canvas);
  const metrics = new RuntimeMetrics(
    {
      metrics: [
        {
          id: "calls",
          label: "draw calls",
          sample: () => 0
        }
      ]
    },
    {
      recorder,
      overlay,
      loop: new GameLoop({ source: new ManualFrameSource() }),
      keyboard: {
        on: () => undefined,
        off: () => undefined
      }
    }
  );

  return {
    recorder,
    overlay,
    metrics,
    dispose(): void {
      metrics.dispose();
      overlay.dispose();
      canvas.remove();
    }
  };
}

describe("RuntimeMetrics", () => {
  it("registers the renderer source on the recorder", () => {
    const { recorder, dispose } = createMetrics();
    const ids = recorder.definitions.map(({ id }) => id);

    assert.ok(ids.includes("calls"));
    dispose();
  });

  it("mounts the HUD and the panel an option asks for", async() => {
    const { metrics, overlay, dispose } = createMetrics();
    const host = document.createElement("div");

    await metrics.mount({
      panel: {
        target: host
      }
    });

    assert.ok(metrics.hud);
    assert.ok(metrics.panel);
    assert.equal(overlay.element.childElementCount, 1);
    assert.equal(host.childElementCount, 1);
    dispose();
  });

  it("leaves the mounted HUD in place when mount is false", async() => {
    const { metrics, overlay, dispose } = createMetrics();
    const hud = await metrics.mountHud();

    await metrics.mount({ mount: false });

    assert.strictEqual(metrics.hud, hud);
    assert.equal(overlay.element.childElementCount, 1);
    dispose();
  });

  it("keeps one HUD, replacing it on every mount", async() => {
    const { metrics, overlay, dispose } = createMetrics();

    const first = await metrics.mountHud();
    const second = await metrics.mountHud();

    assert.strictEqual(metrics.hud, second);
    assert.notStrictEqual(first, second);
    assert.equal(overlay.element.childElementCount, 1);
    dispose();
  });

  it("unmounts the panel when its signal aborts", async() => {
    const { metrics, dispose } = createMetrics();
    const host = document.createElement("div");
    const controller = new AbortController();

    await metrics.mountPanel({
      target: host,
      signal: controller.signal
    });
    controller.abort();

    assert.equal(metrics.panel, null);
    assert.equal(host.childElementCount, 0);
    dispose();
  });

  it("skips a mount aborted before it resolves and keeps the current panel", async() => {
    const { metrics, dispose } = createMetrics();
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
    dispose();
  });

  it("keeps one panel, replacing it on every mount", async() => {
    const { metrics, dispose } = createMetrics();
    const host = document.createElement("div");

    const first = await metrics.mountPanel({ target: host });
    const second = await metrics.mountPanel({ target: host });

    assert.strictEqual(metrics.panel, second);
    assert.notStrictEqual(first, second);
    assert.equal(host.childElementCount, 1);
    dispose();
  });

  it("dispose removes the HUD and the panel", async() => {
    const { metrics, overlay, dispose } = createMetrics();
    const host = document.createElement("div");
    await metrics.mountHud();
    await metrics.mountPanel({ target: host });

    metrics.dispose();

    assert.strictEqual(metrics.hud, null);
    assert.strictEqual(metrics.panel, null);
    assert.equal(overlay.element.childElementCount, 0);
    assert.equal(host.childElementCount, 0);
    dispose();
  });
});
