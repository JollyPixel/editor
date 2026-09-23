// Import Node.js Dependencies
import { before, describe, mock, test } from "node:test";
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
let bootstrap: typeof import("../src/bootstrap/bootstrapRuntime.ts").bootstrapRuntime;

before(async() => {
  installBrowserGlobals();

  ({ Runtime: RuntimeClass } = await import("../src/Runtime.ts"));
  ({ bootstrapRuntime: bootstrap } = await import(
    "../src/bootstrap/bootstrapRuntime.ts"
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
  const setPixelRatio = mock.fn((_ratio: number) => void 0);
  const runtime = Object.assign(
    Object.create(RuntimeClass.prototype),
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

describe("Runtime.load (pixel ratio)", () => {
  test("adapts the pixel ratio to the device by default", async() => {
    const { runtime, setPixelRatio } = createFakeRuntime();

    await runtime.load({ skipLoadingScreen: true });

    assert.strictEqual(setPixelRatio.mock.callCount(), 1);
  });

  test("keeps the pixel ratio when adaptation is turned off", async() => {
    const { runtime, setPixelRatio } = createFakeRuntime();

    await bootstrap(
      runtime,
      { skipLoadingScreen: true },
      { adaptivePixelRatio: false }
    );

    assert.strictEqual(setPixelRatio.mock.callCount(), 0);
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
