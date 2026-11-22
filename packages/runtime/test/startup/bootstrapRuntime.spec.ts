// Import Node.js Dependencies
import { describe, mock, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  AssetCatalog,
  AssetCoordinator,
  AssetLoaderRegistry
} from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  bootstrapRuntime,
  type RuntimeBootstrapBackend,
  type RuntimeBootstrapHost
} from "../../src/startup/bootstrapRuntime.ts";
import type {
  RuntimeLogger,
  RuntimeLogMeta
} from "../../src/contract/RuntimeLogger.ts";

function createFakeRuntime() {
  const canvas = document.createElement("canvas");
  const coordinator = new AssetCoordinator({
    catalog: new AssetCatalog([]),
    loaders: new AssetLoaderRegistry()
  });

  const startCalls: string[] = [];
  const firstFrame = Promise.withResolvers<void>();
  const runtime = {
    canvas,
    loop: { scheduler: { maxFps: Infinity } },
    world: { assetCoordinator: coordinator },
    start: () => {
      startCalls.push("start");
    },
    nextFrame: () => firstFrame.promise
  } as unknown as RuntimeBootstrapHost;
  const adaptPixelRatio = mock.fn((_ratio: number) => void 0);
  const loadScene = mock.fn((_scene: string) => Promise.resolve());
  const backend: RuntimeBootstrapBackend<string> = {
    adaptPixelRatio,
    loadScene
  };

  return {
    runtime,
    backend,
    loadScene,
    startCalls,
    adaptPixelRatio,
    firstFrame
  };
}

function createRecordingLogger() {
  const entries: Array<[string, RuntimeLogMeta | undefined]> = [];
  const logger: RuntimeLogger = {
    debug(message, meta) {
      entries.push([message, meta]);
    },
    isNamespaceEnabled: () => true,
    step(name, run) {
      entries.push([`step ${name}`, undefined]);

      return run();
    }
  };

  return { logger, entries };
}

describe("bootstrapRuntime (skipLoadingScreen)", () => {
  test("never mounts the loading screen and shows the canvas immediately", async() => {
    const container = document.createElement("div");
    const { runtime, backend, startCalls } = createFakeRuntime();

    await bootstrapRuntime(runtime, backend, {
      skipLoadingScreen: true,
      loadingContainer: container
    });

    assert.strictEqual(container.childElementCount, 0);
    assert.strictEqual(runtime.canvas.style.opacity, "1");
    assert.deepStrictEqual(startCalls, ["start"]);
  });

  test("waits for the initial scene before starting", async() => {
    const { runtime, backend, loadScene, startCalls } = createFakeRuntime();
    const requested = Promise.withResolvers<string>();
    const scene = Promise.withResolvers<void>();
    loadScene.mock.mockImplementation((name) => {
      requested.resolve(name);

      return scene.promise;
    });

    const bootstrap = bootstrapRuntime(runtime, backend, {
      skipLoadingScreen: true,
      scene: "level"
    });

    assert.strictEqual(await requested.promise, "level");
    assert.deepStrictEqual(startCalls, []);

    scene.resolve();
    await bootstrap;

    assert.deepStrictEqual(startCalls, ["start"]);
  });

  test("rethrows a failed scene load without building a loading screen error panel", async() => {
    const container = document.createElement("div");
    const { runtime, backend, loadScene, startCalls } = createFakeRuntime();
    const failure = new Error("missing asset");
    loadScene.mock.mockImplementation(() => Promise.reject(failure));

    await assert.rejects(
      () => bootstrapRuntime(runtime, backend, {
        skipLoadingScreen: true,
        loadingContainer: container,
        scene: "failing"
      }),
      failure
    );

    assert.strictEqual(container.childElementCount, 0);
    assert.deepStrictEqual(startCalls, []);
  });
});

describe("bootstrapRuntime (pixel ratio)", () => {
  test("hands the device pixel ratio to the backend", async() => {
    const { runtime, backend, adaptPixelRatio } = createFakeRuntime();

    await bootstrapRuntime(runtime, backend, { skipLoadingScreen: true });

    assert.strictEqual(adaptPixelRatio.mock.callCount(), 1);
  });
});

describe("bootstrapRuntime (tracing)", () => {
  test("traces each step, then waits for the first frame", async() => {
    const { runtime, backend, firstFrame } = createFakeRuntime();
    const { logger, entries } = createRecordingLogger();

    await bootstrapRuntime(
      runtime,
      backend,
      {
        skipLoadingScreen: true,
        scene: "empty"
      },
      logger
    );

    assert.deepStrictEqual(entries, [
      ["step device", undefined],
      ["step assets", undefined],
      ["step scene", undefined],
      ["waiting for first frame", { visibility: document.visibilityState }]
    ]);

    firstFrame.resolve();
    await firstFrame.promise;

    assert.deepStrictEqual(entries.at(-1), ["first frame", undefined]);
  });
});
