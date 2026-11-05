// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import type { RuntimeOptions } from "../../src/three/Runtime.ts";
import { constructRuntime } from "./helpers/constructRuntime.ts";
import { FakeRenderer } from "./helpers/FakeRenderer.ts";
import { stubProperty } from "../helpers/stubProperty.ts";

function createRuntime(
  options: RuntimeOptions = {}
) {
  const canvas = document.createElement("canvas");
  document.body.append(canvas);
  const renderer = new FakeRenderer(canvas);
  const runtime = constructRuntime(canvas, renderer, options);

  return {
    runtime,
    renderer,
    dispose(): void {
      runtime.dispose();
      canvas.remove();
    }
  };
}

describe("Runtime device loss", () => {
  stubProperty(globalThis.navigator, "getGamepads", () => []);

  test("logs the lost device as an error", () => {
    const lines: string[] = [];
    const metas: Array<Record<string, unknown> | undefined> = [];
    function record(
      line: string,
      meta?: Record<string, unknown>
    ): void {
      lines.push(line);
      metas.push(meta);
    }
    const logger = new Systems.Logger({
      level: "debug",
      namespaces: ["*"],
      adapter: {
        log: record,
        warn: record,
        error: record
      }
    }).child({ namespace: "runtime" });
    const { renderer, dispose } = createRuntime({ logger });

    renderer.emit("deviceLost", {
      api: "WebGPU",
      message: "GPU reset",
      reason: "unknown"
    });

    assert.deepStrictEqual(lines, [
      "[ERROR] [runtime] GPU device lost, reload the page to render again"
    ]);
    assert.deepStrictEqual(metas, [
      {
        api: "WebGPU",
        message: "GPU reset",
        reason: "unknown"
      }
    ]);
    dispose();
  });
});

describe("Runtime renderer metrics", () => {
  stubProperty(globalThis.navigator, "getGamepads", () => []);

  test("latches the renderer counters on every draw until disposed", () => {
    const { runtime, renderer, dispose } = createRuntime();
    const { render } = renderer.source.info;

    render.drawCalls = 12;
    render.triangles = 300;
    renderer.draw();
    render.drawCalls = 0;

    assert.equal(runtime.metrics.renderer.frame.drawCalls, 12);
    assert.equal(runtime.metrics.renderer.frame.triangles, 300);

    dispose();
    render.drawCalls = 7;
    renderer.draw();
    assert.equal(runtime.metrics.renderer.frame.drawCalls, 12);
  });
});

describe("Runtime pixel ratio", () => {
  stubProperty(globalThis.navigator, "getGamepads", () => []);

  test("fits the pixel ratio to the device on load", async() => {
    const { runtime, renderer, dispose } = createRuntime();

    await runtime.load({
      skipLoadingScreen: true,
      maxFps: 60
    });

    assert.equal(renderer.source.pixelRatios.length, 1);
    dispose();
  });

  test("keeps a pixel ratio fixed by the renderer options", async() => {
    const { runtime, renderer, dispose } = createRuntime({
      renderer: {
        output: { pixelRatio: 2 }
      }
    });

    await runtime.load({
      skipLoadingScreen: true,
      maxFps: 60
    });

    assert.deepEqual(renderer.source.pixelRatios, []);
    dispose();
  });
});
