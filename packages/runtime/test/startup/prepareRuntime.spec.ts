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
  prepareRuntime,
  type RuntimeStartupBackend,
  type RuntimeStartupHost
} from "../../src/startup/prepareRuntime.ts";
import {
  SilentLogger,
  type RuntimeLogger
} from "../../src/contract/RuntimeLogger.ts";

function createFakeRuntime() {
  const runtime = {
    canvas: document.createElement("canvas"),
    loop: { scheduler: { maxFps: Infinity } },
    world: {
      assetCoordinator: new AssetCoordinator({
        catalog: new AssetCatalog([]),
        loaders: new AssetLoaderRegistry()
      })
    }
  } as unknown as RuntimeStartupHost;
  const adaptPixelRatio = mock.fn((_ratio: number) => void 0);
  const loadScene = mock.fn((_scene: string) => Promise.resolve());
  const backend: RuntimeStartupBackend<string> = {
    adaptPixelRatio,
    loadScene
  };

  return {
    runtime,
    backend,
    loadScene,
    adaptPixelRatio
  };
}

function createRecordingLogger() {
  const steps: string[] = [];
  const logger: RuntimeLogger = {
    warn: () => undefined,
    step(name, run) {
      steps.push(name);

      return run();
    }
  };

  return { logger, steps };
}

describe("prepareRuntime (skipLoadingScreen)", () => {
  test("never mounts the loading screen and shows the canvas immediately", async() => {
    const container = document.createElement("div");
    const { runtime, backend } = createFakeRuntime();

    await prepareRuntime(runtime, backend, new SilentLogger(), {
      skipLoadingScreen: true,
      loadingContainer: container
    });

    assert.strictEqual(container.childElementCount, 0);
    assert.strictEqual(runtime.canvas.style.opacity, "1");
  });

  test("resolves only once the initial scene has loaded", async() => {
    const { runtime, backend, loadScene } = createFakeRuntime();
    const requested = Promise.withResolvers<string>();
    const scene = Promise.withResolvers<void>();
    loadScene.mock.mockImplementation((name) => {
      requested.resolve(name);

      return scene.promise;
    });
    let prepared = false;

    const preparation = prepareRuntime(runtime, backend, new SilentLogger(), {
      skipLoadingScreen: true,
      scene: "level"
    }).then(() => {
      prepared = true;
    });

    assert.strictEqual(await requested.promise, "level");
    assert.strictEqual(prepared, false);

    scene.resolve();
    await preparation;

    assert.strictEqual(prepared, true);
  });

  test("rethrows a failed scene load without building a loading screen error panel", async() => {
    const container = document.createElement("div");
    const { runtime, backend, loadScene } = createFakeRuntime();
    const failure = new Error("missing asset");
    loadScene.mock.mockImplementation(() => Promise.reject(failure));

    await assert.rejects(
      () => prepareRuntime(runtime, backend, new SilentLogger(), {
        skipLoadingScreen: true,
        loadingContainer: container,
        scene: "failing"
      }),
      failure
    );

    assert.strictEqual(container.childElementCount, 0);
  });
});

describe("prepareRuntime (pixel ratio)", () => {
  test("hands the device pixel ratio to the backend", async() => {
    const { runtime, backend, adaptPixelRatio } = createFakeRuntime();

    await prepareRuntime(runtime, backend, new SilentLogger(), {
      skipLoadingScreen: true
    });

    assert.strictEqual(adaptPixelRatio.mock.callCount(), 1);
  });
});

describe("prepareRuntime (tracing)", () => {
  test("traces the device, assets and scene steps", async() => {
    const { runtime, backend } = createFakeRuntime();
    const { logger, steps } = createRecordingLogger();

    await prepareRuntime(
      runtime,
      backend,
      logger,
      {
        skipLoadingScreen: true,
        scene: "empty"
      }
    );

    assert.deepStrictEqual(steps, ["device", "assets", "scene"]);
  });
});
