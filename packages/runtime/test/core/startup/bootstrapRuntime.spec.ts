// Import Node.js Dependencies
import { describe, mock, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  AssetCatalog,
  AssetCoordinator,
  AssetLoaderRegistry,
  AssetNotFoundError,
  AssetRecord,
  AssetReference,
  AssetType
} from "@jolly-pixel/asset";
import { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import {
  bootstrapRuntime,
  type RuntimeBootstrapBackend,
  type RuntimeBootstrapHost
} from "../../../src/core/startup/bootstrapRuntime.ts";
import { loadEngineScene } from "../../../src/three/loadEngineScene.ts";

// CONSTANTS
const kPendingAsset = new AssetType<string>("pending");

class TestScene extends Systems.Scene {
}

function createFakeRuntime() {
  const canvas = document.createElement("canvas");
  const coordinator = new AssetCoordinator({
    catalog: new AssetCatalog([
      new AssetRecord({
        id: "pending",
        kind: kPendingAsset.kind,
        path: "pending.bin"
      })
    ]),
    loaders: new AssetLoaderRegistry().register(kPendingAsset, {
      load: () => Promise.withResolvers<string>().promise
    })
  });
  const sceneManager = new Systems.SceneManager(new Systems.HeadlessSceneGraph());

  const startCalls: string[] = [];
  const world = {
    logger: new Systems.Logger(),
    assetCoordinator: coordinator,
    sceneManager
  };
  sceneManager.bindWorld(world as any);

  const firstFrame = Promise.withResolvers<void>();
  const runtime = {
    canvas,
    loop: { scheduler: { maxFps: Infinity } },
    world,
    start: () => {
      startCalls.push("start");
    },
    nextFrame: () => firstFrame.promise
  } as unknown as RuntimeBootstrapHost;
  const adaptPixelRatio = mock.fn((_ratio: number) => void 0);
  const backend: RuntimeBootstrapBackend<Systems.Scene> = {
    adaptPixelRatio,
    loadScene: (scene, onProgress) => loadEngineScene(
      sceneManager,
      scene,
      onProgress
    )
  };

  return {
    runtime,
    backend,
    sceneManager,
    startCalls,
    adaptPixelRatio,
    firstFrame
  };
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
    const {
      runtime,
      backend,
      sceneManager,
      startCalls
    } = createFakeRuntime();
    const scene = new TestScene("empty");

    await bootstrapRuntime(runtime, backend, {
      skipLoadingScreen: true,
      scene
    });

    assert.strictEqual(sceneManager.sceneLoad?.scene, scene);
    assert.strictEqual(sceneManager.sceneLoad?.status, "ready");
    assert.deepStrictEqual(startCalls, ["start"]);
  });

  test("rethrows failures without building a loading screen error panel", async() => {
    const container = document.createElement("div");
    const { runtime, backend, startCalls } = createFakeRuntime();
    const scene = new TestScene("failing", {
      assets: [new AssetReference("missing", kPendingAsset)]
    });

    await assert.rejects(
      () => bootstrapRuntime(runtime, backend, {
        skipLoadingScreen: true,
        loadingContainer: container,
        scene
      }),
      AssetNotFoundError
    );

    assert.strictEqual(container.childElementCount, 0);
    assert.deepStrictEqual(startCalls, []);
  });

  test("rejects without starting when the initial scene load is cancelled", { timeout: 5_000 }, async() => {
    const {
      runtime,
      backend,
      sceneManager,
      startCalls
    } = createFakeRuntime();
    const scene = new TestScene("cancelled", {
      assets: [new AssetReference("pending", kPendingAsset)]
    });
    sceneManager.once("sceneLoadRequested", (load) => {
      queueMicrotask(() => load.cancel());
    });

    await assert.rejects(
      () => bootstrapRuntime(runtime, backend, {
        skipLoadingScreen: true,
        scene
      }),
      {
        message: "Scene load was cancelled."
      }
    );

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

    await bootstrapRuntime(
      runtime,
      backend,
      {
        skipLoadingScreen: true,
        scene: new TestScene("empty")
      },
      logger
    );

    assert.deepStrictEqual(lines, [
      "[DEBUG] [runtime] device started",
      "[DEBUG] [runtime] device done",
      "[DEBUG] [runtime] assets started",
      "[DEBUG] [runtime] assets done",
      "[DEBUG] [runtime] scene started",
      "[DEBUG] [runtime] scene done",
      "[DEBUG] [runtime] waiting for first frame"
    ]);
    assert.deepStrictEqual(metas.at(-1), {
      visibility: document.visibilityState
    });

    firstFrame.resolve();
    await firstFrame.promise;

    assert.strictEqual(lines.at(-1), "[DEBUG] [runtime] first frame");
  });
});
