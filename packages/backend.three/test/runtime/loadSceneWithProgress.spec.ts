// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  AssetCatalog,
  AssetCoordinator,
  AssetLoaderRegistry,
  AssetRecord,
  AssetReference,
  AssetType
} from "@jolly-pixel/asset";
import { Systems } from "@jolly-pixel/ecs";
import type { RuntimeSceneProgress } from "@jolly-pixel/runtime";

// Import Internal Dependencies
import { loadSceneWithProgress } from "../../src/runtime/loadSceneWithProgress.ts";

// CONSTANTS
const kPendingAsset = new AssetType<string>("pending");

class TestScene extends Systems.Scene {
}

function createSceneManager() {
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
  sceneManager.bindWorld({
    logger: new Systems.Logger(),
    assetCoordinator: coordinator,
    sceneManager
  } as any);

  return sceneManager;
}

describe("loadSceneWithProgress", () => {
  test("resolves once the scene manager has loaded the scene, reporting its progress", async() => {
    const sceneManager = createSceneManager();
    const scene = new TestScene("empty");
    const reports: RuntimeSceneProgress[] = [];

    await loadSceneWithProgress(sceneManager, scene, (progress) => reports.push(progress));

    assert.strictEqual(sceneManager.sceneLoad?.scene, scene);
    assert.strictEqual(sceneManager.sceneLoad?.status, "ready");
    assert.ok(reports.length > 0);
    assert.ok(reports.every((progress) => progress === sceneManager.sceneLoad));
  });

  test("rejects when the scene load is cancelled", { timeout: 5_000 }, async() => {
    const sceneManager = createSceneManager();
    const scene = new TestScene("cancelled", {
      assets: [new AssetReference("pending", kPendingAsset)]
    });
    sceneManager.once("sceneLoadRequested", (load) => {
      queueMicrotask(() => load.cancel());
    });

    await assert.rejects(
      () => loadSceneWithProgress(sceneManager, scene, () => undefined),
      {
        message: "Scene load was cancelled."
      }
    );
  });
});
