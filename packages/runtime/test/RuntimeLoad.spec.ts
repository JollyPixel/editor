// Import Node.js Dependencies
import { describe, mock, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  AssetCatalog,
  AssetCoordinator,
  AssetLoaderRegistry
} from "@jolly-pixel/asset";
import { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import { Runtime } from "../src/Runtime.ts";
import { RuntimeSceneLoader } from "../src/assets/RuntimeSceneLoader.ts";
import { bootstrapRuntime } from "../src/bootstrap/bootstrapRuntime.ts";

class TestScene extends Systems.Scene {
}

function createFakeRuntime(
  sceneLoader?: Systems.SceneLoader
) {
  const canvas = document.createElement("canvas");
  const coordinator = new AssetCoordinator({
    catalog: new AssetCatalog(),
    loaders: new AssetLoaderRegistry()
  });
  const sceneManager = new Systems.SceneManager();
  sceneManager.setSceneLoader(
    sceneLoader ?? new RuntimeSceneLoader(coordinator)
  );

  const startCalls: string[] = [];
  const setPixelRatio = mock.fn((_ratio: number) => void 0);
  const runtime = Object.assign(
    Object.create(Runtime.prototype),
    {
      canvas,
      // configureRuntimeDevice writes the detected refresh rate here.
      loop: { scheduler: { maxFps: Infinity } },
      world: {
        renderer: {
          getSource: () => {
            return { setPixelRatio };
          }
        },
        assetCoordinator: coordinator,
        sceneManager
      },
      start: () => {
        startCalls.push("start");
      }
    }
  ) as Runtime;

  return { runtime, startCalls, setPixelRatio };
}

describe("Runtime.load (skipLoadingScreen)", () => {
  test("never mounts the loading screen and shows the canvas immediately", async() => {
    const container = document.createElement("div");
    const { runtime, startCalls } = createFakeRuntime();

    await runtime.load({
      skipLoadingScreen: true,
      loadingContainer: container
    });

    assert.strictEqual(container.childElementCount, 0);
    assert.strictEqual(runtime.canvas.style.opacity, "1");
    assert.deepStrictEqual(startCalls, ["start"]);
  });

  test("rethrows failures without building a loading screen error panel", async() => {
    const container = document.createElement("div");
    const { runtime, startCalls } = createFakeRuntime({
      load: (driver) => driver.fail(new Error("scene load failed"))
    });
    const scene = new TestScene("failing", { assets: [] });

    await assert.rejects(
      () => runtime.load({
        skipLoadingScreen: true,
        loadingContainer: container,
        scene
      }),
      /scene load failed/
    );

    assert.strictEqual(container.childElementCount, 0);
    assert.deepStrictEqual(startCalls, []);
  });

  test("rejects without starting when the initial scene load is cancelled", { timeout: 5_000 }, async() => {
    const { runtime, startCalls } = createFakeRuntime({
      load: (driver) => {
        queueMicrotask(() => driver.load.cancel());
      }
    });
    const scene = new TestScene("cancelled", { assets: [] });

    await assert.rejects(
      () => runtime.load({
        skipLoadingScreen: true,
        scene
      }),
      {
        message: "Initial scene loading was cancelled."
      }
    );

    assert.deepStrictEqual(startCalls, []);
  });
});

describe("Runtime.load (pixel ratio)", () => {
  test("adapts the pixel ratio to the device by default", async() => {
    const { runtime, setPixelRatio } = createFakeRuntime();

    await runtime.load({ skipLoadingScreen: true });

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
