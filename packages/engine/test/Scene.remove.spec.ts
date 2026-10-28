// Import Node.js Dependencies
import {
  describe,
  test,
  mock,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
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
    Scene.Id.clear();
  });

  describe("removeScene", () => {
    test("removeScene(name) emits sceneRemoved", () => {
      const { sm } = createSceneSetup();
      const appended = new ConcreteScene("prefab");
      const listener = mock.fn();

      sm.on("sceneRemoved", listener);
      activateAppendedScene(sm, appended);
      sm.removeScene("prefab");

      assert.strictEqual(listener.mock.calls.length, 1);
      assert.strictEqual(listener.mock.calls[0].arguments[0], appended);
    });

    test("removeScene(name) removes ALL scenes sharing that name", () => {
      const { sm } = createSceneSetup();
      const a = new ConcreteScene("shared");
      const b = new ConcreteScene("shared");

      activateAppendedScene(sm, a);
      activateAppendedScene(sm, b);
      sm.removeScene("shared");

      assert.strictEqual(sm.getScene("shared").length, 0);
      assert.strictEqual(sm.getScene(a.id), null);
      assert.strictEqual(a.destroySpy.mock.calls.length, 1);
      assert.strictEqual(b.destroySpy.mock.calls.length, 1);
    });

    test("removeScene(scene) removes by scene instance", () => {
      const { sm } = createSceneSetup();
      const a = new ConcreteScene("shared");
      const b = new ConcreteScene("shared");

      activateAppendedScene(sm, a);
      activateAppendedScene(sm, b);
      sm.removeScene(a);

      assert.strictEqual(sm.getScene(a.id), null);
      assert.ok(sm.getScene(b.id) !== null, "b should still be appended");
      assert.strictEqual(a.destroySpy.mock.calls.length, 1);
      assert.strictEqual(b.destroySpy.mock.calls.length, 0);
    });

    test("removeScene(scene) stops calling update on removed scene", () => {
      const { sm } = createSceneSetup();
      const appended = new ConcreteScene("prefab");

      activateAppendedScene(sm, appended);
      sm.beginFrame();
      sm.update(kDeltaTime);

      sm.removeScene(appended);
      sm.update(kDeltaTime);

      assert.strictEqual(appended.updateSpy.mock.calls.length, 1);
    });

    test("removeScene cancels an unfinished request", () => {
      const assets = createSceneAssets(["a"]);
      const { sm } = createSceneSetup(assets);
      const appended = new ConcreteScene("prefab", {
        assets: [assets.reference("a")]
      });

      const load = sm.appendScene(appended);
      sm.removeScene(appended);
      sm.beginFrame();

      assert.strictEqual(load.status, "cancelled");
      assert.strictEqual(sm.getScene(appended.id), null);
      assert.strictEqual(appended.awakeSpy.mock.calls.length, 0);
    });
  });

  describe("scene replacement clears appended scenes", () => {
    test("replacement tears down all appended scenes", () => {
      const { sm } = createSceneSetup();
      const main = new ConcreteScene("main");
      const prefabA = new ConcreteScene("A");
      const prefabB = new ConcreteScene("B");

      activateScene(sm, main);
      activateAppendedScene(sm, prefabA);
      activateAppendedScene(sm, prefabB);
      activateScene(sm, new ConcreteScene("next"));

      assert.strictEqual(prefabA.destroySpy.mock.calls.length, 1);
      assert.strictEqual(prefabB.destroySpy.mock.calls.length, 1);
      assert.strictEqual(sm.getScene("A").length, 0);
      assert.strictEqual(sm.getScene("B").length, 0);
    });

    test("replacement emits sceneRemoved before appended teardown", () => {
      const { sm } = createSceneSetup();
      const main = new ConcreteScene("main");
      const prefab = new ConcreteScene("prefab");
      const events: string[] = [];

      sm.on("sceneRemoved", (scene) => events.push(`sceneRemoved:${scene.name}`));
      prefab.destroySpy = mock.fn(() => {
        events.push("destroy:prefab");
      });
      activateScene(sm, main);
      activateAppendedScene(sm, prefab);
      activateScene(sm, new ConcreteScene("next"));

      assert.deepEqual(events, ["sceneRemoved:prefab", "destroy:prefab"]);
    });

    test("replacement cancels an unfinished request", async() => {
      const assets = createSceneAssets(["a"]);
      const { sm } = createSceneSetup(assets);
      const appended = new ConcreteScene("prefab", {
        assets: [assets.reference("a")]
      });
      const replacement = new ConcreteScene("next");

      const appendedLoad = sm.appendScene(appended);
      sm.loadScene(replacement);
      sm.beginFrame();

      assets.loader.resolve("a");
      await assert.rejects(appendedLoad.done);
      sm.beginFrame();

      assert.strictEqual(appendedLoad.status, "cancelled");
      assert.strictEqual(sm.currentScene, replacement);
      assert.strictEqual(sm.getScene(appended.id), null);
    });
  });
});
