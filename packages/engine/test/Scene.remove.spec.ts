// Import Node.js Dependencies
import {
  describe,
  test,
  mock,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Actor } from "../src/actor/index.ts";
import { Scene } from "../src/systems/scene/Scene.ts";
import {
  ConcreteScene,
  createSceneSetup,
  activateScene,
  activateAppendedScene
} from "./helpers/sceneSetup.ts";

// CONSTANTS
const kDeltaTime = 1 / 60;

describe("Scene", () => {
  beforeEach(() => {
    Actor.Id.clear();
    Actor.PersistentId.clear();
    Scene.Id.clear();
  });

  describe("removeScene", () => {
    test("removeScene(name) calls destroy on the scene", () => {
      const { sm } = createSceneSetup();
      const appended = new ConcreteScene("prefab");

      activateAppendedScene(sm, appended);
      sm.removeScene("prefab");

      assert.strictEqual(appended.destroySpy.mock.calls.length, 1);
    });

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

    test("removeScene(name) removes the entry from the registry", () => {
      const { sm } = createSceneSetup();
      const appended = new ConcreteScene("prefab");

      activateAppendedScene(sm, appended);
      sm.removeScene("prefab");

      assert.strictEqual(sm.getScene(appended.id), null);
    });

    test("removeScene(name) destroys owned actors", () => {
      const { sm, world } = createSceneSetup();

      class PrefabScene extends ConcreteScene {
        override awake() {
          super.awake();
          world.createActor("PrefabActor");
        }
      }

      const appended = new PrefabScene("prefab");
      activateAppendedScene(sm, appended);

      assert.ok(sm.getActor("PrefabActor") !== null, "actor should exist after append");
      sm.removeScene("prefab");
      assert.strictEqual(sm.getActor("PrefabActor"), null, "actor should be gone after remove");
    });

    test("removeScene(name) removes ALL scenes sharing that name", () => {
      const { sm } = createSceneSetup();
      const a = new ConcreteScene("shared");
      const b = new ConcreteScene("shared");

      activateAppendedScene(sm, a);
      activateAppendedScene(sm, b);
      sm.removeScene("shared");

      assert.strictEqual(sm.getScene("shared").length, 0);
      assert.strictEqual(a.destroySpy.mock.calls.length, 1);
      assert.strictEqual(b.destroySpy.mock.calls.length, 1);
    });

    test("removeScene(name) is a no-op when no scene matches", () => {
      const { sm } = createSceneSetup();

      assert.doesNotThrow(() => sm.removeScene("nonexistent"));
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
      const removed: string[] = [];

      sm.on("sceneRemoved", (s) => removed.push(s.name));
      activateScene(sm, main);
      activateAppendedScene(sm, prefab);
      activateScene(sm, new ConcreteScene("next"));

      assert.deepEqual(removed, ["prefab"]);
    });
  });
});
