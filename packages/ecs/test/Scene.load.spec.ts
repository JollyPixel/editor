// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach,
  mock
} from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Third-party Dependencies
import {
  AssetBatchLoadError,
  AssetNotFoundError
} from "@jolly-pixel/asset";

// Import Internal Dependencies
import { Scene } from "../src/systems/scene/Scene.ts";
import { createSceneAssets } from "./helpers/scene/sceneAssets.ts";
import {
  ConcreteScene,
  createSceneSetup
} from "./helpers/scene/sceneSetup.ts";

class PreparingScene extends ConcreteScene {
  prepared = Promise.withResolvers<void>();

  override prepare(): Promise<void> {
    return this.prepared.promise;
  }
}

describe("Scene", () => {
  beforeEach(() => {
    Scene.Id.clear();
  });

  describe("loadScene", () => {
    test("returns a ready load and queues asset-free scenes", () => {
      const { sm } = createSceneSetup();
      const scene = new ConcreteScene("test");

      const load = sm.loadScene(scene);

      assert.strictEqual(load.scene, scene);
      assert.strictEqual(load.status, "ready");
      assert.strictEqual(sm.hasPendingScene, true);
      assert.strictEqual(sm.sceneLoad, load);
    });

    test("activates and starts a ready scene at the next beginFrame", () => {
      const { sm } = createSceneSetup();
      const scene = new ConcreteScene("test");

      const load = sm.loadScene(scene);
      assert.strictEqual(sm.currentScene, null);
      assert.strictEqual(scene.awakeSpy.mock.calls.length, 0);
      assert.strictEqual(scene.startSpy.mock.calls.length, 0);

      sm.beginFrame();
      assert.strictEqual(sm.currentScene, scene);
      assert.strictEqual(load.status, "active");
      assert.strictEqual(sm.hasPendingScene, false);
      assert.strictEqual(scene.awakeSpy.mock.calls.length, 1);
      assert.strictEqual(scene.startSpy.mock.calls.length, 1);
    });

    test("waits for manual activation after assets are ready", () => {
      const { sm } = createSceneSetup();
      const scene = new ConcreteScene("test");

      const load = sm.loadScene(scene, {
        activation: "manual"
      });
      sm.beginFrame();

      assert.strictEqual(load.status, "ready");
      assert.strictEqual(sm.currentScene, null);
      assert.strictEqual(sm.hasPendingScene, false);

      load.allowActivation();
      assert.strictEqual(sm.hasPendingScene, true);

      sm.beginFrame();
      assert.strictEqual(load.status, "active");
      assert.strictEqual(sm.currentScene, scene);
    });

    test("reports asset progress and queues the scene once its assets are ready", async() => {
      const assets = createSceneAssets(["a", "b"]);
      const { sm } = createSceneSetup({ assets });
      const scene = new ConcreteScene("test", {
        assets: [assets.reference("a"), assets.reference("b")]
      });

      const load = sm.loadScene(scene);

      assert.strictEqual(load.status, "loading");
      assert.strictEqual(load.completed, 0);
      assert.strictEqual(load.total, 2);
      assert.strictEqual(sm.hasPendingScene, false);

      assets.loader.resolve("a");
      await setImmediate();
      assert.strictEqual(load.completed, 1);
      assert.strictEqual(load.currentAsset?.id.value, "a");

      assets.loader.resolve("b");
      await load.done;
      assert.strictEqual(load.status, "ready");
      assert.strictEqual(load.completed, 2);
      assert.strictEqual(sm.hasPendingScene, true);
    });

    test("keeps a manually allowed load waiting until assets are ready", async() => {
      const assets = createSceneAssets(["a"]);
      const { sm } = createSceneSetup({ assets });
      const scene = new ConcreteScene("test", {
        assets: [assets.reference("a")]
      });
      const load = sm.loadScene(scene, {
        activation: "manual"
      });

      load.allowActivation();
      sm.beginFrame();
      assert.strictEqual(sm.currentScene, null);

      assets.loader.resolve("a");
      await load.done;
      sm.beginFrame();
      assert.strictEqual(sm.currentScene, scene);
      assert.strictEqual(load.status, "active");
    });

    test("cancels an older replacement request", async() => {
      const assets = createSceneAssets(["a", "b"]);
      const { sm } = createSceneSetup({ assets });
      const first = new ConcreteScene("first", {
        assets: [assets.reference("a")]
      });
      const second = new ConcreteScene("second", {
        assets: [assets.reference("b")]
      });

      const firstLoad = sm.loadScene(first);
      const secondLoad = sm.loadScene(second);
      assert.strictEqual(firstLoad.status, "cancelled");
      await assert.rejects(firstLoad.done, /Scene load was cancelled/);

      assets.loader.resolve("a");
      assets.loader.resolve("b");
      await secondLoad.done;
      sm.beginFrame();

      assert.strictEqual(firstLoad.status, "cancelled");
      assert.strictEqual(secondLoad.status, "active");
      assert.strictEqual(sm.currentScene, second);
    });

    test("fails when an asset is missing from the catalog", async() => {
      const assets = createSceneAssets();
      const { sm } = createSceneSetup({ assets });
      const scene = new ConcreteScene("level", {
        assets: [assets.reference("missing")]
      });

      const load = sm.loadScene(scene);

      assert.strictEqual(load.status, "failed");
      assert.ok(load.error instanceof AssetNotFoundError);
      await assert.rejects(load.done, AssetNotFoundError);
    });

    test("retains asset failures without replacing the scene", async() => {
      const assets = createSceneAssets(["a"]);
      const { sm } = createSceneSetup({ assets });
      const scene = new ConcreteScene("test", {
        assets: [assets.reference("a")]
      });
      const error = new Error("load failed");

      const load = sm.loadScene(scene);
      assets.loader.reject("a", error);
      await assert.rejects(load.done);
      sm.beginFrame();

      assert.strictEqual(load.status, "failed");
      assert.ok(load.error instanceof AssetBatchLoadError);
      assert.strictEqual(load.error.failures[0]?.error, error);
      assert.strictEqual(sm.currentScene, null);
      assert.strictEqual(sm.hasPendingScene, false);
    });
  });

  describe("prepare", () => {
    test("keeps the load requested until the scene is prepared, then loads its assets", async() => {
      const assets = createSceneAssets(["a"]);
      const { sm } = createSceneSetup({ assets });
      const scene = new PreparingScene("level", {
        assets: [assets.reference("a")]
      });

      const load = sm.loadScene(scene);
      assert.deepStrictEqual([load.status, sm.sceneLoad], ["requested", load]);

      scene.prepared.resolve();
      await setImmediate();
      assert.deepStrictEqual([load.status, load.total], ["loading", 1]);

      assets.loader.resolve("a");
      await load.done;
      sm.beginFrame();
      assert.strictEqual(sm.currentScene, scene);
    });

    test("loads no asset of a replacement cancelled while it prepares", async() => {
      const assets = createSceneAssets(["a"]);
      const { sm } = createSceneSetup({ assets });
      const loads = mock.method(assets.loader, "load");
      const level = new PreparingScene("level", {
        assets: [assets.reference("a")]
      });
      const menu = new ConcreteScene("menu");

      const levelLoad = sm.loadScene(level);
      sm.loadScene(menu);
      level.prepared.resolve();
      await setImmediate();
      sm.beginFrame();

      assert.strictEqual(levelLoad.status, "cancelled");
      assert.strictEqual(loads.mock.callCount(), 0);
      assert.strictEqual(sm.currentScene, menu);
    });

    test("fails the load with the error the scene fails to prepare with", async() => {
      const { sm } = createSceneSetup();
      const scene = new PreparingScene("level");
      const error = new Error("scene file is missing");

      const load = sm.loadScene(scene);
      scene.prepared.reject(error);
      await assert.rejects(load.done, error);

      assert.deepStrictEqual([load.status, load.error], ["failed", error]);
    });
  });

  describe("loadSceneAsset", () => {
    test("loads the scene its source returns for the ref", () => {
      const { sm } = createSceneSetup();
      const level = new ConcreteScene("level-2");
      const refs: string[] = [];
      sm.sceneSource = {
        scene: (ref) => {
          refs.push(ref);

          return level;
        }
      };

      const load = sm.loadSceneAsset("levels/level-2");
      sm.beginFrame();

      assert.deepStrictEqual(refs, ["levels/level-2"]);
      assert.strictEqual(load.scene, level);
      assert.strictEqual(sm.currentScene, level);
    });

    test("throws without a scene source", () => {
      const { sm } = createSceneSetup();

      assert.throws(
        () => sm.loadSceneAsset("level-2"),
        /No scene source to load scene "level-2" from/
      );
    });
  });
});
