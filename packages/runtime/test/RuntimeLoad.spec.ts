// Import Node.js Dependencies
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Window } from "happy-dom";
import {
  AssetCatalog,
  AssetCoordinator,
  AssetLoaderRegistry
} from "@jolly-pixel/asset";
import { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import type { Runtime } from "../src/Runtime.ts";
import { RuntimeSceneLoader } from "../src/assets/RuntimeSceneLoader.ts";

const kBrowserWindow = new Window();

let RuntimeClass: typeof import("../src/Runtime.ts").Runtime;

before(async() => {
  installBrowserGlobals();

  ({ Runtime: RuntimeClass } = await import("../src/Runtime.ts"));
});

class TestScene extends Systems.Scene {
}

function createFakeRuntime(
  sceneFails = false
) {
  const canvas = document.createElement("canvas");
  const coordinator = new AssetCoordinator({
    catalog: new AssetCatalog(),
    loaders: new AssetLoaderRegistry()
  });
  const sceneManager = new Systems.SceneManager();
  sceneManager.setSceneLoader(
    sceneFails
      ? { load: (driver) => driver.fail(new Error("scene load failed")) }
      : new RuntimeSceneLoader(coordinator)
  );

  const startCalls: string[] = [];
  const runtime = Object.assign(
    Object.create(RuntimeClass.prototype),
    {
      canvas,
      // configureRuntimeDevice writes the detected refresh rate here.
      loop: { scheduler: { maxFps: Infinity } },
      world: {
        renderer: {
          getSource: () => {
            return { setPixelRatio: () => void 0 };
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

  return { runtime, startCalls };
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
    const { runtime, startCalls } = createFakeRuntime(true);
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
});

function installBrowserGlobals(): void {
  Object.assign(globalThis, {
    window: kBrowserWindow,
    document: kBrowserWindow.document,
    HTMLElement: kBrowserWindow.HTMLElement,
    customElements: kBrowserWindow.customElements,
    requestAnimationFrame: kBrowserWindow.requestAnimationFrame.bind(kBrowserWindow)
  });
}
