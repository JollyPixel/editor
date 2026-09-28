// Import Node.js Dependencies
import { beforeEach, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Third-party Dependencies
import {
  AssetBatchLoadError,
  AssetNotFoundError
} from "@jolly-pixel/asset";

// Import Internal Dependencies
import { Actor } from "../../src/actor/index.ts";
import { Logger } from "../../src/systems/Logger.ts";
import { Scene } from "../../src/systems/scene/Scene.ts";
import { SceneManager } from "../../src/systems/scene/SceneManager.ts";
import {
  createSceneAssets,
  type SceneAssets
} from "../sceneAssets.ts";

class ConcreteScene extends Scene {
  awakeSpy = mock.fn();

  override awake(): void {
    this.awakeSpy();
  }
}

function createSceneManager(
  assets: SceneAssets = createSceneAssets()
): SceneManager {
  const sceneManager = new SceneManager();
  const world = {
    logger: new Logger(),
    sceneManager,
    assetCoordinator: assets.coordinator,
    createActor(name: string) {
      return new Actor(this as any, {
        name
      });
    }
  };
  sceneManager.bindWorld(world as any);

  return sceneManager;
}

describe("Systems.SceneManager loading", () => {
  beforeEach(() => {
    Actor.Id.clear();
    Actor.PersistentId.clear();
    Scene.Id.clear();
  });

  describe("loadScene", () => {
    test("reports asset progress until the scene is ready", async() => {
      const assets = createSceneAssets(["a", "b"]);
      const sceneManager = createSceneManager(assets);
      const scene = new ConcreteScene("level", {
        assets: [assets.reference("a"), assets.reference("b")]
      });

      const load = sceneManager.loadScene(scene);
      assert.strictEqual(load.status, "loading");
      assert.strictEqual(load.completed, 0);
      assert.strictEqual(load.total, 2);

      assets.loader.resolve("a");
      await setImmediate();
      assert.strictEqual(load.completed, 1);
      assert.strictEqual(load.currentAsset?.id.value, "a");

      assets.loader.resolve("b");
      await load.done;
      assert.strictEqual(load.status, "ready");
      assert.strictEqual(load.completed, 2);
    });

    test("is ready synchronously when it declares no assets", () => {
      const sceneManager = createSceneManager();

      const load = sceneManager.loadScene(new ConcreteScene("empty"));

      assert.strictEqual(load.status, "ready");
      assert.strictEqual(sceneManager.hasPendingScene, true);
    });

    test("fails when an asset is missing from the catalog", async() => {
      const assets = createSceneAssets();
      const sceneManager = createSceneManager(assets);
      const scene = new ConcreteScene("level", {
        assets: [assets.reference("missing")]
      });

      const load = sceneManager.loadScene(scene);

      assert.strictEqual(load.status, "failed");
      assert.ok(load.error instanceof AssetNotFoundError);
      await assert.rejects(load.done, AssetNotFoundError);
    });

    test("rejects done when a newer request cancels it", async() => {
      const assets = createSceneAssets(["a"]);
      const sceneManager = createSceneManager(assets);
      const first = new ConcreteScene("first", {
        assets: [assets.reference("a")]
      });

      const load = sceneManager.loadScene(first);
      sceneManager.loadScene(new ConcreteScene("second"));

      assert.strictEqual(load.status, "cancelled");
      await assert.rejects(load.done, /Scene load was cancelled/);
    });
  });

  describe("appendScene", () => {
    test("waits for its assets before appending the scene", async() => {
      const assets = createSceneAssets(["a"]);
      const sceneManager = createSceneManager(assets);
      const appended = new ConcreteScene("prefab", {
        assets: [assets.reference("a")]
      });

      const load = sceneManager.appendScene(appended);
      sceneManager.beginFrame();

      assert.strictEqual(load.status, "loading");
      assert.strictEqual(sceneManager.getScene(appended.id), null);
      assert.strictEqual(appended.awakeSpy.mock.calls.length, 0);

      assets.loader.resolve("a");
      await load.done;
      sceneManager.beginFrame();

      assert.strictEqual(load.status, "active");
      assert.strictEqual(sceneManager.getScene(appended.id), appended);
      assert.strictEqual(appended.awakeSpy.mock.calls.length, 1);
    });

    test("supports manual activation for appended scenes", () => {
      const sceneManager = createSceneManager();
      const appended = new ConcreteScene("prefab");

      const load = sceneManager.appendScene(appended, {
        activation: "manual"
      });
      sceneManager.beginFrame();

      assert.strictEqual(load.status, "ready");
      assert.strictEqual(sceneManager.getScene(appended.id), null);

      load.allowActivation();
      sceneManager.beginFrame();

      assert.strictEqual(load.status, "active");
      assert.strictEqual(sceneManager.getScene(appended.id), appended);
    });

    test("loads different appended scenes independently", async() => {
      const assets = createSceneAssets(["a", "b"]);
      const sceneManager = createSceneManager(assets);
      const first = new ConcreteScene("first", {
        assets: [assets.reference("a")]
      });
      const second = new ConcreteScene("second", {
        assets: [assets.reference("b")]
      });

      const firstLoad = sceneManager.appendScene(first);
      const secondLoad = sceneManager.appendScene(second);
      assets.loader.resolve("a");
      assets.loader.resolve("b");
      await Promise.all([firstLoad.done, secondLoad.done]);
      sceneManager.beginFrame();

      assert.strictEqual(firstLoad.status, "active");
      assert.strictEqual(secondLoad.status, "active");
      assert.strictEqual(sceneManager.getScene(first.id), first);
      assert.strictEqual(sceneManager.getScene(second.id), second);
    });

    test("does not append a scene when an asset fails", async() => {
      const assets = createSceneAssets(["a"]);
      const sceneManager = createSceneManager(assets);
      const appended = new ConcreteScene("prefab", {
        assets: [assets.reference("a")]
      });
      const error = new Error("load failed");

      const load = sceneManager.appendScene(appended);
      assets.loader.reject("a", error);
      await assert.rejects(load.done, AssetBatchLoadError);
      sceneManager.beginFrame();

      assert.strictEqual(load.status, "failed");
      assert.ok(load.error instanceof AssetBatchLoadError);
      assert.strictEqual(load.error.failures[0]?.error, error);
      assert.strictEqual(sceneManager.getScene(appended.id), null);
      assert.strictEqual(appended.awakeSpy.mock.calls.length, 0);
    });
  });

  describe("additive cancellation", () => {
    test("removeScene cancels an unfinished request", () => {
      const assets = createSceneAssets(["a"]);
      const sceneManager = createSceneManager(assets);
      const appended = new ConcreteScene("prefab", {
        assets: [assets.reference("a")]
      });

      const load = sceneManager.appendScene(appended);
      sceneManager.removeScene(appended);
      sceneManager.beginFrame();

      assert.strictEqual(load.status, "cancelled");
      assert.strictEqual(sceneManager.getScene(appended.id), null);
      assert.strictEqual(appended.awakeSpy.mock.calls.length, 0);
    });

    test("replacement cancels an unfinished request", async() => {
      const assets = createSceneAssets(["a"]);
      const sceneManager = createSceneManager(assets);
      const appended = new ConcreteScene("prefab", {
        assets: [assets.reference("a")]
      });
      const replacement = new ConcreteScene("next");

      const appendedLoad = sceneManager.appendScene(appended);
      sceneManager.loadScene(replacement);
      sceneManager.beginFrame();

      assets.loader.resolve("a");
      await assert.rejects(appendedLoad.done);
      sceneManager.beginFrame();

      assert.strictEqual(appendedLoad.status, "cancelled");
      assert.strictEqual(sceneManager.currentScene, replacement);
      assert.strictEqual(sceneManager.getScene(appended.id), null);
    });
  });
});
