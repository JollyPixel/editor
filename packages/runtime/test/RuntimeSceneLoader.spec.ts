// Import Node.js Dependencies
import { setImmediate } from "node:timers/promises";
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  AssetCatalog,
  AssetCoordinator,
  AssetId,
  AssetLoaderRegistry,
  AssetRecord,
  AssetReference,
  AssetType
} from "@jolly-pixel/asset";
import { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import { RuntimeSceneLoader } from "../src/assets/RuntimeSceneLoader.ts";

const TextAssetType = new AssetType<string>("text");

class TestScene extends Systems.Scene {
}

function createSetup(
  loadAsset: () => Promise<string>
) {
  const record = new AssetRecord({
    id: new AssetId("dialogue.intro"),
    kind: TextAssetType.kind,
    source: "/dialogue/intro.txt"
  });
  const reference = new AssetReference(
    record.id,
    TextAssetType
  );
  const catalog = new AssetCatalog();
  catalog.add(record);
  const loaders = new AssetLoaderRegistry();
  loaders.register(TextAssetType, {
    load: loadAsset
  });
  const coordinator = new AssetCoordinator({
    catalog,
    loaders
  });
  const sceneManager = new Systems.SceneManager();
  sceneManager.setSceneLoader(
    new RuntimeSceneLoader(coordinator)
  );
  const scene = new TestScene("intro", {
    assets: [reference]
  });

  return {
    record,
    scene,
    sceneManager
  };
}

describe("RuntimeSceneLoader", () => {
  test("reports asset progress and readiness to SceneManager", async() => {
    const {
      promise,
      resolve
    } = Promise.withResolvers<string>();
    const {
      record,
      scene,
      sceneManager
    } = createSetup(() => promise);

    const load = sceneManager.loadScene(scene, {
      activation: "manual"
    });
    assert.strictEqual(load.status, "loading");
    assert.strictEqual(load.completed, 0);
    assert.strictEqual(load.total, 1);

    resolve("ready");
    await promise;
    await setImmediate();

    assert.strictEqual(load.status, "ready");
    assert.strictEqual(load.completed, 1);
    assert.strictEqual(load.currentAsset, record);
    assert.strictEqual(sceneManager.hasPendingScene, false);

    load.allowActivation();
    assert.strictEqual(sceneManager.hasPendingScene, true);
  });

  test("reports batch failures without queuing the scene", async() => {
    const error = new Error("load failed");
    const {
      scene,
      sceneManager
    } = createSetup(async() => {
      throw error;
    });

    const load = sceneManager.loadScene(scene);
    await setImmediate();

    assert.strictEqual(load.status, "failed");
    assert.strictEqual(load.completed, 1);
    assert.ok(load.error);
    assert.strictEqual(sceneManager.hasPendingScene, false);
  });

  test("ignores completion after a request is cancelled", async() => {
    const {
      promise,
      resolve
    } = Promise.withResolvers<string>();
    const {
      scene,
      sceneManager
    } = createSetup(() => promise);

    const load = sceneManager.loadScene(scene);
    load.cancel();
    resolve("ready");
    await promise;
    await setImmediate();

    assert.strictEqual(load.status, "cancelled");
    assert.strictEqual(sceneManager.hasPendingScene, false);
  });
});
