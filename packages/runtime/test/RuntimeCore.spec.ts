// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { setImmediate } from "node:timers/promises";

// Import Third-party Dependencies
import {
  AssetCatalog,
  AssetCoordinator,
  AssetLoaderRegistry
} from "@jolly-pixel/asset";
import { ManualFrameSource } from "@jolly-pixel/loop";

// Import Internal Dependencies
import { RuntimeCore } from "../src/RuntimeCore.ts";
import type {
  RuntimeBackend,
  RuntimeWorld
} from "../src/contract/RuntimeBackend.ts";
import type {
  RuntimeLogger,
  RuntimeLogMeta
} from "../src/contract/RuntimeLogger.ts";

describe("RuntimeCore", () => {
  test("load starts the runtime once the scene has loaded", async() => {
    const requested = Promise.withResolvers<void>();
    const scene = Promise.withResolvers<void>();
    const { runtime, dispose } = createRuntime({
      loadScene: () => {
        requested.resolve();

        return scene.promise;
      }
    });

    const loading = runtime.load({
      skipLoadingScreen: true,
      maxFps: 60,
      scene: "level"
    });
    await requested.promise;
    assert.equal(runtime.running, false);

    scene.resolve();
    await loading;

    assert.equal(runtime.running, true);
    dispose();
  });

  test("load traces the first frame with the page visibility", async() => {
    const steps: Array<[string, RuntimeLogMeta | undefined]> = [];
    const finished: string[] = [];
    const logger: RuntimeLogger = {
      warn: () => undefined,
      async step(
        name,
        run,
        meta
      ) {
        steps.push([name, meta]);
        const result = await run();
        finished.push(name);

        return result;
      }
    };
    const { runtime, source, dispose } = createRuntime({ logger });

    await runtime.load({
      skipLoadingScreen: true,
      maxFps: 60
    });

    assert.deepEqual(steps.at(-1), [
      "first frame",
      { visibility: document.visibilityState }
    ]);
    assert.equal(finished.includes("first frame"), false);

    source.step(16);
    await setImmediate();

    assert.equal(finished.includes("first frame"), true);
    dispose();
  });

  test("dispose releases the world it assigned to globalThis.game", () => {
    const { runtime, dispose } = createRuntime();
    assert.strictEqual(Reflect.get(globalThis, "game"), runtime.world);

    dispose();

    assert.equal(Reflect.has(globalThis, "game"), false);
  });
});

interface CreateRuntimeOptions {
  loadScene?: () => Promise<void>;
  logger?: RuntimeLogger;
}

function createRuntime(
  options: CreateRuntimeOptions = {}
) {
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const source = new ManualFrameSource();
  const backend: RuntimeBackend<RuntimeWorld, string> = {
    world: createWorld(),
    frameSource: source,
    metrics: { metrics: [] },
    adaptPixelRatio: () => undefined,
    loadScene: options.loadScene ?? (() => Promise.resolve()),
    start: () => undefined,
    stop: () => undefined,
    dispose: () => undefined
  };
  const runtime = new RuntimeCore(canvas, backend, {
    logger: options.logger
  });

  return {
    runtime,
    source,
    dispose(): void {
      runtime.dispose();
      canvas.remove();
    }
  };
}

function createWorld(): RuntimeWorld {
  const invalidated = new Set<() => void>();
  const updated = new Set<() => void>();

  return {
    animating: false,
    input: {
      wasActive: false,
      keyboard: {
        on: () => undefined,
        off: () => undefined
      },
      gamepad: {
        connectedGamepads: 0,
        wasActive: false,
        sample: () => undefined
      }
    },
    assetCoordinator: new AssetCoordinator({
      catalog: new AssetCatalog([]),
      loaders: new AssetLoaderRegistry()
    }),
    tick() {
      const handlers = [...updated];
      updated.clear();
      for (const handler of handlers) {
        handler();
      }

      return false;
    },
    invalidate() {
      for (const handler of invalidated) {
        handler();
      }
    },
    on(_type, handler) {
      invalidated.add(handler);
    },
    once(_type, handler) {
      updated.add(handler);
    }
  };
}
