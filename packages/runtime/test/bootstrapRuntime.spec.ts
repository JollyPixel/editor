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
import type { Runtime } from "../src/Runtime.ts";
import { bootstrapRuntime } from "../src/bootstrap/bootstrapRuntime.ts";

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
        source: "pending.bin"
      })
    ]),
    loaders: new AssetLoaderRegistry().register(kPendingAsset, {
      load: () => new Promise<string>(() => void 0)
    })
  });
  const sceneManager = new Systems.SceneManager();

  const startCalls: string[] = [];
  const setPixelRatio = mock.fn((_ratio: number) => void 0);
  const world = {
    logger: new Systems.Logger(),
    renderer: {
      getSource: () => {
        return { setPixelRatio };
      }
    },
    assetCoordinator: coordinator,
    sceneManager
  };
  sceneManager.bindWorld(world as any);

  const runtime = {
    canvas,
    loop: { scheduler: { maxFps: Infinity } },
    world,
    start: () => {
      startCalls.push("start");
    }
  } as unknown as Runtime;

  return { runtime, startCalls, setPixelRatio };
}

describe("bootstrapRuntime (skipLoadingScreen)", () => {
  test("never mounts the loading screen and shows the canvas immediately", async() => {
    const container = document.createElement("div");
    const { runtime, startCalls } = createFakeRuntime();

    await bootstrapRuntime(runtime, {
      skipLoadingScreen: true,
      loadingContainer: container
    });

    assert.strictEqual(container.childElementCount, 0);
    assert.strictEqual(runtime.canvas.style.opacity, "1");
    assert.deepStrictEqual(startCalls, ["start"]);
  });

  test("waits for the initial scene before starting", async() => {
    const { runtime, startCalls } = createFakeRuntime();
    const scene = new TestScene("empty");

    await bootstrapRuntime(runtime, {
      skipLoadingScreen: true,
      scene
    });

    assert.strictEqual(runtime.world.sceneManager.sceneLoad?.scene, scene);
    assert.strictEqual(runtime.world.sceneManager.sceneLoad?.status, "ready");
    assert.deepStrictEqual(startCalls, ["start"]);
  });

  test("rethrows failures without building a loading screen error panel", async() => {
    const container = document.createElement("div");
    const { runtime, startCalls } = createFakeRuntime();
    const scene = new TestScene("failing", {
      assets: [new AssetReference("missing", kPendingAsset)]
    });

    await assert.rejects(
      () => bootstrapRuntime(runtime, {
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
    const { runtime, startCalls } = createFakeRuntime();
    const { sceneManager } = runtime.world;
    const scene = new TestScene("cancelled", {
      assets: [new AssetReference("pending", kPendingAsset)]
    });
    sceneManager.once("sceneLoadRequested", (load) => {
      queueMicrotask(() => load.cancel());
    });

    await assert.rejects(
      () => bootstrapRuntime(runtime, {
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
  test("adapts the pixel ratio to the device by default", async() => {
    const { runtime, setPixelRatio } = createFakeRuntime();

    await bootstrapRuntime(runtime, { skipLoadingScreen: true });

    assert.strictEqual(setPixelRatio.mock.callCount(), 1);
  });

  test("keeps the pixel ratio when adaptation is turned off", async() => {
    const { runtime, setPixelRatio } = createFakeRuntime();

    await bootstrapRuntime(
      runtime,
      { skipLoadingScreen: true },
      { adaptivePixelRatio: false }
    );

    assert.strictEqual(setPixelRatio.mock.callCount(), 0);
  });
});
