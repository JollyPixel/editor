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

let loadRuntimeFn: typeof import("../src/bootstrap/loadRuntime.ts").loadRuntime;

before(async() => {
  installBrowserGlobals();

  ({ loadRuntime: loadRuntimeFn } = await import(
    "../src/bootstrap/loadRuntime.ts"
  ));
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
  const runtime = {
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
  } as unknown as Runtime;

  return { runtime, startCalls };
}

describe("loadRuntime (skipLoadingScreen)", () => {
  test("never mounts the loading screen and shows the canvas immediately", async() => {
    const container = document.createElement("div");
    const { runtime, startCalls } = createFakeRuntime();

    await loadRuntimeFn(runtime, {
      skipLoadingScreen: true,
      loadingContainer: container
    });

    assert.strictEqual(container.childElementCount, 0);
    assert.strictEqual(runtime.canvas.style.opacity, "1");
    assert.deepStrictEqual(startCalls, ["start"]);
  });

  test("rethrows failures without building a loading screen error panel", async() => {
    const container = document.createElement("div");
    const { runtime } = createFakeRuntime(true);
    const scene = new TestScene("failing", { assets: [] });

    await assert.rejects(
      () => loadRuntimeFn(runtime, {
        skipLoadingScreen: true,
        loadingContainer: container,
        scene
      }),
      /scene load failed/
    );

    assert.strictEqual(container.childElementCount, 0);
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
