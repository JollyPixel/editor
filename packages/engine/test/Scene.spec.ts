// Import Node.js Dependencies
import {
  describe,
  test,
  mock,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Actor, ActorComponent } from "../src/actor/index.ts";
import { Scene } from "../src/systems/scene/Scene.ts";
import {
  ConcreteScene,
  createSceneSetup,
  activateScene
} from "./helpers/scene/sceneSetup.ts";

describe("Scene", () => {
  beforeEach(() => {
    Actor.Id.clear();
    Actor.PersistentId.clear();
    Scene.Id.clear();
  });

  describe("scene activation", () => {
    test("injects world reference into the scene before awake", () => {
      const { sm, world } = createSceneSetup();
      const scene = new ConcreteScene("test");

      let worldAtAwakeTime: unknown;
      scene.awakeSpy = mock.fn(() => {
        worldAtAwakeTime = scene.world;
      });

      activateScene(sm, scene);

      assert.strictEqual(worldAtAwakeTime, world);
    });

    test("emits sceneChanged with the new scene", () => {
      const { sm } = createSceneSetup();
      const scene = new ConcreteScene("test");
      const listener = mock.fn();

      sm.on("sceneChanged", listener);
      activateScene(sm, scene);

      assert.strictEqual(listener.mock.calls.length, 1);
      assert.strictEqual(listener.mock.calls[0].arguments[0], scene);
    });

    test("getScene() with no argument returns the current scene", () => {
      const { sm } = createSceneSetup();
      const scene = new ConcreteScene("test");

      assert.strictEqual(sm.getScene(), null);
      activateScene(sm, scene);
      assert.strictEqual(sm.getScene(), scene);
    });

    test("only calls scene.start() once across multiple beginFrame calls", () => {
      const { sm } = createSceneSetup();
      const scene = new ConcreteScene("test");

      sm.loadScene(scene);
      sm.beginFrame();
      sm.beginFrame();
      sm.beginFrame();

      assert.strictEqual(scene.startSpy.mock.calls.length, 1);
    });

    test("tears down previous scene when swapping", () => {
      const { sm } = createSceneSetup();
      const sceneA = new ConcreteScene("A");
      const sceneB = new ConcreteScene("B");

      activateScene(sm, sceneA);
      activateScene(sm, sceneB);

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

      activateScene(sm, sceneA);
      activateScene(sm, sceneB);

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

      activateScene(sm, sceneA);
      assert.ok(sm.getActor("ActorA") !== null, "ActorA should exist after activation");
      assert.ok(sm.getActor("ActorB") !== null, "ActorB should exist after activation");

      activateScene(sm, sceneB);
      assert.strictEqual(sm.getActor("ActorA"), null, "ActorA should be gone after scene swap");
      assert.strictEqual(sm.getActor("ActorB"), null, "ActorB should be gone after scene swap");
    });

    test("drops pending component starts when swapping scenes", () => {
      const { sm, world } = createSceneSetup();
      const sceneA = new ConcreteScene("A");
      activateScene(sm, sceneA);

      const start = mock.fn();
      class Pending extends ActorComponent {
        start = start;

        constructor(
          actor: Actor
        ) {
          super({ actor, typeName: "Pending" });
        }
      }
      world.createActor("Pending").addComponentAndGet(Pending);

      activateScene(sm, new ConcreteScene("B"));
      sm.beginFrame();

      assert.strictEqual(start.mock.callCount(), 0);
    });
  });
});
