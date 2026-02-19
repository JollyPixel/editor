
// Import Node.js Dependencies
import { describe, test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Actor } from "../src/actor/index.ts";
import { Scene } from "../src/systems/Scene.ts";
import { SceneManager } from "../src/systems/SceneManager.ts";

// CONSTANTS
const kDeltaTime = 1 / 60;

class ConcreteScene extends Scene {
  awakeSpy = mock.fn();
  startSpy = mock.fn();
  updateSpy = mock.fn();
  fixedUpdateSpy = mock.fn();
  destroySpy = mock.fn();

  override awake(): void {
    this.awakeSpy();
  }

  override start(): void {
    this.startSpy();
  }

  override update(deltaTime: number): void {
    this.updateSpy(deltaTime);
  }

  override fixedUpdate(deltaTime: number): void {
    this.fixedUpdateSpy(deltaTime);
  }

  override destroy(): void {
    this.destroySpy();
  }
}

function createSceneSetup() {
  const sm = new SceneManager();
  const world = {
    sceneManager: sm,
    createActor(name: string) {
      return new Actor(this as any, { name });
    }
  };
  sm.bindWorld(world as any);

  return { sm, world };
}

describe("Scene", () => {
  beforeEach(() => {
    Actor.Id.clear();
    Actor.PersistentId.clear();
    Scene.Id.clear();
  });

  describe("setScene", () => {
    test("injects world reference into the scene before awake", () => {
      const { sm, world } = createSceneSetup();
      const scene = new ConcreteScene("test");

      let worldAtAwakeTime: unknown;
      scene.awakeSpy = mock.fn(() => {
        worldAtAwakeTime = scene.world;
      });

      sm.setScene(scene);

      assert.strictEqual(worldAtAwakeTime, world);
    });

    test("calls scene.awake()", () => {
      const { sm } = createSceneSetup();
      const scene = new ConcreteScene("test");

      sm.setScene(scene);

      assert.strictEqual(scene.awakeSpy.mock.calls.length, 1);
    });

    test("emits sceneChanged with the new scene", () => {
      const { sm } = createSceneSetup();
      const scene = new ConcreteScene("test");
      const listener = mock.fn();

      sm.on("sceneChanged", listener);
      sm.setScene(scene);

      assert.strictEqual(listener.mock.calls.length, 1);
      assert.strictEqual(listener.mock.calls[0].arguments[0], scene);
    });

    test("exposes the scene via currentScene accessor", () => {
      const { sm } = createSceneSetup();
      const scene = new ConcreteScene("test");

      assert.strictEqual(sm.currentScene, null);
      sm.setScene(scene);
      assert.strictEqual(sm.currentScene, scene);
    });

    test("getScene() with no argument returns the current scene", () => {
      const { sm } = createSceneSetup();
      const scene = new ConcreteScene("test");

      assert.strictEqual(sm.getScene(), null);
      sm.setScene(scene);
      assert.strictEqual(sm.getScene(), scene);
    });

    test("does NOT call scene.start() immediately", () => {
      const { sm } = createSceneSetup();
      const scene = new ConcreteScene("test");

      sm.setScene(scene);

      assert.strictEqual(scene.startSpy.mock.calls.length, 0);
    });

    test("calls scene.start() on the first beginFrame after setScene", () => {
      const { sm } = createSceneSetup();
      const scene = new ConcreteScene("test");

      sm.setScene(scene);
      assert.strictEqual(scene.startSpy.mock.calls.length, 0);

      sm.beginFrame();
      assert.strictEqual(scene.startSpy.mock.calls.length, 1);
    });

    test("only calls scene.start() once across multiple beginFrame calls", () => {
      const { sm } = createSceneSetup();
      const scene = new ConcreteScene("test");

      sm.setScene(scene);
      sm.beginFrame();
      sm.beginFrame();
      sm.beginFrame();

      assert.strictEqual(scene.startSpy.mock.calls.length, 1);
    });

    test("tears down previous scene when swapping", () => {
      const { sm } = createSceneSetup();
      const sceneA = new ConcreteScene("A");
      const sceneB = new ConcreteScene("B");

      sm.setScene(sceneA);
      sm.setScene(sceneB);

      assert.strictEqual(sceneA.destroySpy.mock.calls.length, 1);
    });

    test("emits sceneDestroyed before tearing down previous scene", () => {
      const { sm } = createSceneSetup();
      const sceneA = new ConcreteScene("A");
      const sceneB = new ConcreteScene("B");

      const events: string[] = [];
      sm.on("sceneDestroyed", () => {
        events.push("sceneDestroyed");
      });
      sceneA.destroySpy = mock.fn(() => {
        events.push("destroy");
      });

      sm.setScene(sceneA);
      sm.setScene(sceneB);

      assert.deepEqual(events, ["sceneDestroyed", "destroy"]);
    });

    test("destroys all registered actors from previous scene", () => {
      const { sm, world } = createSceneSetup();

      class ActorSpawningScene extends ConcreteScene {
        override awake() {
          super.awake();
          world.createActor("ActorA");
          world.createActor("ActorB");
        }
      }

      const sceneA = new ActorSpawningScene("A");
      const sceneB = new ConcreteScene("B");

      sm.setScene(sceneA);
      assert.ok(sm.getActor("ActorA") !== null, "ActorA should exist after setScene(A)");
      assert.ok(sm.getActor("ActorB") !== null, "ActorB should exist after setScene(A)");

      sm.setScene(sceneB);
      assert.strictEqual(sm.getActor("ActorA"), null, "ActorA should be gone after scene swap");
      assert.strictEqual(sm.getActor("ActorB"), null, "ActorB should be gone after scene swap");
    });

    test("clears componentsToBeStarted when swapping scenes", () => {
      const { sm } = createSceneSetup();
      const sceneA = new ConcreteScene("A");

      // Manually push a fake component to simulate pending starts
      sm.componentsToBeStarted.push({ start: mock.fn() } as any);

      sm.setScene(sceneA);
      // Simulate scene swap
      const sceneB = new ConcreteScene("B");
      sm.setScene(sceneB);

      assert.strictEqual(sm.componentsToBeStarted.length, 0);
    });
  });

  describe("loadScene", () => {
    test("does NOT swap scene immediately", () => {
      const { sm } = createSceneSetup();
      const scene = new ConcreteScene("test");

      sm.loadScene(scene);

      assert.strictEqual(sm.currentScene, null);
      assert.strictEqual(scene.awakeSpy.mock.calls.length, 0);
    });

    test("reports hasPendingScene as true after loadScene", () => {
      const { sm } = createSceneSetup();
      const scene = new ConcreteScene("test");

      assert.strictEqual(sm.hasPendingScene, false);
      sm.loadScene(scene);
      assert.strictEqual(sm.hasPendingScene, true);
    });

    test("applies the pending scene at the start of the next beginFrame", () => {
      const { sm } = createSceneSetup();
      const scene = new ConcreteScene("test");

      sm.loadScene(scene);
      assert.strictEqual(sm.currentScene, null);

      sm.beginFrame();
      assert.strictEqual(sm.currentScene, scene);
      assert.strictEqual(scene.awakeSpy.mock.calls.length, 1);
    });

    test("clears hasPendingScene after beginFrame applies it", () => {
      const { sm } = createSceneSetup();
      const scene = new ConcreteScene("test");

      sm.loadScene(scene);
      sm.beginFrame();

      assert.strictEqual(sm.hasPendingScene, false);
    });

    test("scene.start is called on the SAME beginFrame that applies the pending scene", () => {
      const { sm } = createSceneSetup();
      const scene = new ConcreteScene("test");

      sm.loadScene(scene);
      sm.beginFrame();

      // setScene is called inside beginFrame, which sets #sceneStartPending = true,
      // then the same beginFrame checks #sceneStartPending and calls start()
      assert.strictEqual(scene.startSpy.mock.calls.length, 1);
    });
  });

  describe("update / fixedUpdate", () => {
    test("calls scene.update after actor updates", () => {
      const { sm } = createSceneSetup();
      const scene = new ConcreteScene("test");

      sm.setScene(scene);
      sm.beginFrame();
      sm.update(kDeltaTime);

      assert.strictEqual(scene.updateSpy.mock.calls.length, 1);
      assert.strictEqual(scene.updateSpy.mock.calls[0].arguments[0], kDeltaTime);
    });

    test("calls scene.fixedUpdate after actor fixedUpdates", () => {
      const { sm } = createSceneSetup();
      const scene = new ConcreteScene("test");

      sm.setScene(scene);
      sm.beginFrame();
      sm.fixedUpdate(kDeltaTime);

      assert.strictEqual(scene.fixedUpdateSpy.mock.calls.length, 1);
      assert.strictEqual(scene.fixedUpdateSpy.mock.calls[0].arguments[0], kDeltaTime);
    });

    test("does not call update/fixedUpdate when no scene is set", () => {
      const { sm } = createSceneSetup();
      const updateSpy = mock.fn();
      const fixedUpdateSpy = mock.fn();

      // No setScene called — currentScene is null
      sm.update(kDeltaTime);
      sm.fixedUpdate(kDeltaTime);

      assert.strictEqual(updateSpy.mock.calls.length, 0);
      assert.strictEqual(fixedUpdateSpy.mock.calls.length, 0);
    });

    test("scene.update is called every frame", () => {
      const { sm } = createSceneSetup();
      const scene = new ConcreteScene("test");

      sm.setScene(scene);
      sm.beginFrame();
      sm.update(kDeltaTime);
      sm.update(kDeltaTime);
      sm.update(kDeltaTime);

      assert.strictEqual(scene.updateSpy.mock.calls.length, 3);
    });
  });

  describe("Scene.id", () => {
    test("each scene instance gets a unique incrementing id", () => {
      const a = new ConcreteScene("a");
      const b = new ConcreteScene("b");
      const c = new ConcreteScene("c");

      assert.strictEqual(a.id, 0);
      assert.strictEqual(b.id, 1);
      assert.strictEqual(c.id, 2);
    });

    test("two scenes with the same name have different ids", () => {
      const a = new ConcreteScene("same");
      const b = new ConcreteScene("same");

      assert.notStrictEqual(a.id, b.id);
    });
  });

  describe("appendScene", () => {
    test("injects world and calls awake immediately", () => {
      const { sm, world } = createSceneSetup();
      const appended = new ConcreteScene("prefab");

      let worldAtAwakeTime: unknown;
      appended.awakeSpy = mock.fn(() => {
        worldAtAwakeTime = appended.world;
      });

      sm.appendScene(appended);

      assert.strictEqual(worldAtAwakeTime, world);
      assert.strictEqual(appended.awakeSpy.mock.calls.length, 1);
    });

    test("emits sceneAppended with the scene", () => {
      const { sm } = createSceneSetup();
      const appended = new ConcreteScene("prefab");
      const listener = mock.fn();

      sm.on("sceneAppended", listener);
      sm.appendScene(appended);

      assert.strictEqual(listener.mock.calls.length, 1);
      assert.strictEqual(listener.mock.calls[0].arguments[0], appended);
    });

    test("does NOT call scene.start() immediately", () => {
      const { sm } = createSceneSetup();
      const appended = new ConcreteScene("prefab");

      sm.appendScene(appended);

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
      sm.appendScene(appended);
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

      sm.setScene(new MainScene("main"));
      sm.appendScene(new PrefabScene("prefab"));
      sm.removeScene("prefab");

      assert.ok(sm.getActor("MainActor") !== null, "pre-existing actor should survive removeScene");
      assert.strictEqual(sm.getActor("PrefabActor"), null, "owned actor should be destroyed");
    });

    test("multiple appended scenes run update and fixedUpdate each frame", () => {
      const { sm } = createSceneSetup();
      const prefabA = new ConcreteScene("A");
      const prefabB = new ConcreteScene("B");

      sm.appendScene(prefabA);
      sm.appendScene(prefabB);
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

      sm.appendScene(appended);

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

      sm.appendScene(a);
      sm.appendScene(b);
      sm.appendScene(c);

      const scenes = sm.getScene("shared");
      assert.strictEqual(scenes.length, 2);
      assert.ok(scenes.includes(a));
      assert.ok(scenes.includes(b));
    });
  });

  describe("removeScene", () => {
    test("removeScene(name) calls destroy on the scene", () => {
      const { sm } = createSceneSetup();
      const appended = new ConcreteScene("prefab");

      sm.appendScene(appended);
      sm.removeScene("prefab");

      assert.strictEqual(appended.destroySpy.mock.calls.length, 1);
    });

    test("removeScene(name) emits sceneRemoved", () => {
      const { sm } = createSceneSetup();
      const appended = new ConcreteScene("prefab");
      const listener = mock.fn();

      sm.on("sceneRemoved", listener);
      sm.appendScene(appended);
      sm.removeScene("prefab");

      assert.strictEqual(listener.mock.calls.length, 1);
      assert.strictEqual(listener.mock.calls[0].arguments[0], appended);
    });

    test("removeScene(name) removes the entry from the registry", () => {
      const { sm } = createSceneSetup();
      const appended = new ConcreteScene("prefab");

      sm.appendScene(appended);
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
      sm.appendScene(appended);

      assert.ok(sm.getActor("PrefabActor") !== null, "actor should exist after append");
      sm.removeScene("prefab");
      assert.strictEqual(sm.getActor("PrefabActor"), null, "actor should be gone after remove");
    });

    test("removeScene(name) removes ALL scenes sharing that name", () => {
      const { sm } = createSceneSetup();
      const a = new ConcreteScene("shared");
      const b = new ConcreteScene("shared");

      sm.appendScene(a);
      sm.appendScene(b);
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

      sm.appendScene(a);
      sm.appendScene(b);
      sm.removeScene(a);

      assert.strictEqual(sm.getScene(a.id), null);
      assert.ok(sm.getScene(b.id) !== null, "b should still be appended");
      assert.strictEqual(a.destroySpy.mock.calls.length, 1);
      assert.strictEqual(b.destroySpy.mock.calls.length, 0);
    });

    test("removeScene(scene) stops calling update on removed scene", () => {
      const { sm } = createSceneSetup();
      const appended = new ConcreteScene("prefab");

      sm.appendScene(appended);
      sm.beginFrame();
      sm.update(kDeltaTime);

      sm.removeScene(appended);
      sm.update(kDeltaTime);

      assert.strictEqual(appended.updateSpy.mock.calls.length, 1);
    });
  });

  describe("setScene clears appended scenes", () => {
    test("setScene tears down all appended scenes", () => {
      const { sm } = createSceneSetup();
      const main = new ConcreteScene("main");
      const prefabA = new ConcreteScene("A");
      const prefabB = new ConcreteScene("B");

      sm.setScene(main);
      sm.appendScene(prefabA);
      sm.appendScene(prefabB);
      sm.setScene(new ConcreteScene("next"));

      assert.strictEqual(prefabA.destroySpy.mock.calls.length, 1);
      assert.strictEqual(prefabB.destroySpy.mock.calls.length, 1);
      assert.strictEqual(sm.getScene("A").length, 0);
      assert.strictEqual(sm.getScene("B").length, 0);
    });

    test("setScene emits sceneRemoved for each appended scene before teardown", () => {
      const { sm } = createSceneSetup();
      const main = new ConcreteScene("main");
      const prefab = new ConcreteScene("prefab");
      const removed: string[] = [];

      sm.on("sceneRemoved", (s) => removed.push(s.name));
      sm.setScene(main);
      sm.appendScene(prefab);
      sm.setScene(new ConcreteScene("next"));

      assert.deepEqual(removed, ["prefab"]);
    });
  });
});
