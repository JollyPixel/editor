// Import Node.js Dependencies
import {
  describe,
  test,
  mock,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { AssetBatchLoadError } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { Actor } from "../src/actor/index.ts";
import { Scene } from "../src/systems/scene/Scene.ts";
import { createSceneAssets } from "./helpers/scene/sceneAssets.ts";
import {
  ConcreteScene,
  createSceneSetup,
  activateScene,
  activateAppendedScene
} from "./helpers/scene/sceneSetup.ts";

// CONSTANTS
const kDeltaTime = 1 / 60;

describe("Scene", () => {
  beforeEach(() => {
    Actor.Id.clear();
    Actor.PersistentId.clear();
    Scene.Id.clear();
  });

  describe("appendScene", () => {
    test("injects world before awake at the next frame", () => {
      const { sm, world } = createSceneSetup();
      const appended = new ConcreteScene("prefab");

      let worldAtAwakeTime: unknown;
      appended.awakeSpy = mock.fn(() => {
        worldAtAwakeTime = appended.world;
      });

      sm.appendScene(appended);

      assert.strictEqual(appended.awakeSpy.mock.calls.length, 0);
      assert.strictEqual(appended.startSpy.mock.calls.length, 0);

      sm.beginFrame();

      assert.strictEqual(worldAtAwakeTime, world);
      assert.strictEqual(appended.awakeSpy.mock.calls.length, 1);
    });

    test("emits sceneAppended with the scene", () => {
      const { sm } = createSceneSetup();
      const appended = new ConcreteScene("prefab");
      const listener = mock.fn();

      sm.on("sceneAppended", listener);
      sm.appendScene(appended);

      assert.strictEqual(listener.mock.calls.length, 0);

      sm.beginFrame();

      assert.strictEqual(listener.mock.calls.length, 1);
      assert.strictEqual(listener.mock.calls[0].arguments[0], appended);
    });

    test("starts the scene once, on the next beginFrame", () => {
      const { sm } = createSceneSetup();
      const appended = new ConcreteScene("prefab");

      sm.appendScene(appended);
      sm.beginFrame();
      assert.strictEqual(appended.startSpy.mock.calls.length, 1);

      sm.beginFrame();
      sm.beginFrame();
      assert.strictEqual(appended.startSpy.mock.calls.length, 1);
    });

    test("owns the actors created during awake, not the pre-existing ones", () => {
      const { sm, world } = createSceneSetup();

      class MainScene extends ConcreteScene {
        override awake() {
          super.awake();
          world.createActor("MainActor");
        }
      }

      class PrefabScene extends ConcreteScene {
        override awake() {
          super.awake();
          world.createActor("PrefabActor");
        }
      }

      activateScene(sm, new MainScene("main"));
      activateAppendedScene(sm, new PrefabScene("prefab"));
      assert.ok(sm.getActor("PrefabActor") !== null);

      sm.removeScene("prefab");

      assert.ok(sm.getActor("MainActor") !== null, "pre-existing actor should survive removeScene");
      assert.strictEqual(sm.getActor("PrefabActor"), null, "owned actor should be destroyed");
    });

    test("multiple appended scenes run update and fixedUpdate each frame", () => {
      const { sm } = createSceneSetup();
      const prefabA = new ConcreteScene("A");
      const prefabB = new ConcreteScene("B");

      activateAppendedScene(sm, prefabA);
      activateAppendedScene(sm, prefabB);
      sm.beginFrame();
      sm.update(kDeltaTime);
      sm.fixedUpdate(kDeltaTime);

      assert.strictEqual(prefabA.updateSpy.mock.calls.length, 1);
      assert.strictEqual(prefabB.updateSpy.mock.calls.length, 1);
      assert.strictEqual(prefabA.fixedUpdateSpy.mock.calls.length, 1);
      assert.strictEqual(prefabB.fixedUpdateSpy.mock.calls.length, 1);
    });

    test("getScene(id) returns the appended scene by id", () => {
      const { sm } = createSceneSetup();
      const appended = new ConcreteScene("prefab");

      activateAppendedScene(sm, appended);

      assert.strictEqual(sm.getScene(appended.id), appended);
    });

    test("getScene(id) returns null for unknown id", () => {
      const { sm } = createSceneSetup();

      assert.strictEqual(sm.getScene(9999), null);
    });

    test("getScene(name) returns all appended scenes sharing that name", () => {
      const { sm } = createSceneSetup();
      const a = new ConcreteScene("shared");
      const b = new ConcreteScene("shared");
      const c = new ConcreteScene("other");

      activateAppendedScene(sm, a);
      activateAppendedScene(sm, b);
      activateAppendedScene(sm, c);

      const scenes = sm.getScene("shared");
      assert.strictEqual(scenes.length, 2);
      assert.ok(scenes.includes(a));
      assert.ok(scenes.includes(b));
    });
  });

  describe("appendScene loading", () => {
    test("waits for its assets before appending the scene", async() => {
      const assets = createSceneAssets(["a"]);
      const { sm } = createSceneSetup(assets);
      const appended = new ConcreteScene("prefab", {
        assets: [assets.reference("a")]
      });

      const load = sm.appendScene(appended);
      sm.beginFrame();

      assert.strictEqual(load.status, "loading");
      assert.strictEqual(sm.getScene(appended.id), null);
      assert.strictEqual(appended.awakeSpy.mock.calls.length, 0);

      assets.loader.resolve("a");
      await load.done;
      sm.beginFrame();

      assert.strictEqual(load.status, "active");
      assert.strictEqual(sm.getScene(appended.id), appended);
      assert.strictEqual(appended.awakeSpy.mock.calls.length, 1);
    });

    test("supports manual activation for appended scenes", () => {
      const { sm } = createSceneSetup();
      const appended = new ConcreteScene("prefab");

      const load = sm.appendScene(appended, {
        activation: "manual"
      });
      sm.beginFrame();

      assert.strictEqual(load.status, "ready");
      assert.strictEqual(sm.getScene(appended.id), null);

      load.allowActivation();
      sm.beginFrame();

      assert.strictEqual(load.status, "active");
      assert.strictEqual(sm.getScene(appended.id), appended);
    });

    test("loads different appended scenes independently", async() => {
      const assets = createSceneAssets(["a", "b"]);
      const { sm } = createSceneSetup(assets);
      const first = new ConcreteScene("first", {
        assets: [assets.reference("a")]
      });
      const second = new ConcreteScene("second", {
        assets: [assets.reference("b")]
      });

      const firstLoad = sm.appendScene(first);
      const secondLoad = sm.appendScene(second);
      assets.loader.resolve("a");
      assets.loader.resolve("b");
      await Promise.all([firstLoad.done, secondLoad.done]);
      sm.beginFrame();

      assert.strictEqual(firstLoad.status, "active");
      assert.strictEqual(secondLoad.status, "active");
      assert.strictEqual(sm.getScene(first.id), first);
      assert.strictEqual(sm.getScene(second.id), second);
    });

    test("does not append a scene when an asset fails", async() => {
      const assets = createSceneAssets(["a"]);
      const { sm } = createSceneSetup(assets);
      const appended = new ConcreteScene("prefab", {
        assets: [assets.reference("a")]
      });
      const error = new Error("load failed");

      const load = sm.appendScene(appended);
      assets.loader.reject("a", error);
      await assert.rejects(load.done, AssetBatchLoadError);
      sm.beginFrame();

      assert.strictEqual(load.status, "failed");
      assert.ok(load.error instanceof AssetBatchLoadError);
      assert.strictEqual(load.error.failures[0]?.error, error);
      assert.strictEqual(sm.getScene(appended.id), null);
      assert.strictEqual(appended.awakeSpy.mock.calls.length, 0);
    });
  });
});
