// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { AssetCatalog } from "@jolly-pixel/asset";
import { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import { Runtime } from "../src/Runtime.ts";
import { FakeRenderer } from "./helpers/FakeRenderer.ts";

Object.defineProperty(globalThis.navigator, "getGamepads", {
  configurable: true,
  value: () => []
});

describe("Runtime device loss", () => {
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
    const canvas = document.createElement("canvas");
    document.body.append(canvas);
    const renderer = new FakeRenderer(canvas);
    const runtime: Runtime = Reflect.construct(Runtime, [
      canvas,
      renderer,
      new AssetCatalog([]),
      {
        audio: {},
        logger
      }
    ]);

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
    runtime.dispose();
    canvas.remove();
  });
});
