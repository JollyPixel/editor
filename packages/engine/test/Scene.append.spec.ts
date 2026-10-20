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

    test("does not activate or start the scene immediately", () => {
      const { sm } = createSceneSetup();
      const appended = new ConcreteScene("prefab");

      sm.appendScene(appended);

      assert.strictEqual(appended.awakeSpy.mock.calls.length, 0);
      assert.strictEqual(appended.startSpy.mock.calls.length, 0);
    });

    test("calls scene.start() on the next beginFrame", () => {
      const { sm } = createSceneSetup();
      const appended = new ConcreteScene("prefab");

      sm.appendScene(appended);
      sm.beginFrame();

      assert.strictEqual(appended.startSpy.mock.calls.length, 1);
    });

    test("only calls scene.start() once across multiple beginFrame calls", () => {
      const { sm } = createSceneSetup();
      const appended = new ConcreteScene("prefab");

      sm.appendScene(appended);
      sm.beginFrame();
      sm.beginFrame();
      sm.beginFrame();

      assert.strictEqual(appended.startSpy.mock.calls.length, 1);
    });

    test("tracks actors created during awake as owned actors", () => {
      const { sm, world } = createSceneSetup();

      class PrefabScene extends ConcreteScene {
        override awake() {
          super.awake();
          world.createActor("PrefabActorA");
          world.createActor("PrefabActorB");
        }
      }

      const appended = new PrefabScene("prefab");
      activateAppendedScene(sm, appended);
      assert.ok(sm.getActor("PrefabActorA") !== null);
      assert.ok(sm.getActor("PrefabActorB") !== null);

      sm.removeScene(appended);
      assert.strictEqual(sm.getActor("PrefabActorA"), null, "owned actors should be destroyed");
      assert.strictEqual(sm.getActor("PrefabActorB"), null, "owned actors should be destroyed");
    });

    test("does not destroy pre-existing actors when removed", () => {
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
});
