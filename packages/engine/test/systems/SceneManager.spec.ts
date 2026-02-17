// Import Node.js Dependencies
import { describe, test, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { SceneManager } from "../../src/systems/SceneManager.ts";

// CONSTANTS
const kDeltaTime = 16.67;

describe("Systems.SceneManager", () => {
  let sceneManager: SceneManager;
  let mockThreeScene: {
    add: ReturnType<typeof mock.fn>;
    remove: ReturnType<typeof mock.fn>;
  };

  beforeEach(() => {
    mockThreeScene = {
      add: mock.fn(),
      remove: mock.fn()
    };
    // @ts-expect-error
    sceneManager = new SceneManager(mockThreeScene);
  });

  test("should initialize with default values", () => {
    const scene = new SceneManager();

    assert.ok(scene.tree);
    assert.ok(Array.isArray(scene.componentsToBeStarted));
    assert.ok(Array.isArray(scene.componentsToBeDestroyed));
    assert.strictEqual(scene.componentsToBeStarted.length, 0);
    assert.strictEqual(scene.componentsToBeDestroyed.length, 0);
  });

  test("should use provided THREE.Scene", () => {
    const result = sceneManager.getSource();

    assert.strictEqual(result, mockThreeScene);
  });

  test("should awake all non-awoken actors", () => {
    const actor1 = createFakeActor({
      awoken: false,
      name: "Actor 1"
    });
    const actor2 = createFakeActor({
      awoken: true,
      name: "Actor 2"
    });
    const actor3 = createFakeActor({
      awoken: false,
      name: "Actor 3"
    });

    // @ts-expect-error
    sceneManager.tree.children.push(actor1, actor2, actor3);

    sceneManager.awake();

    assert.strictEqual(actor1.awake.mock.calls.length, 1);
    assert.strictEqual(actor2.awake.mock.calls.length, 0);
    assert.strictEqual(actor3.awake.mock.calls.length, 1);
    assert.strictEqual(actor1.awoken, true);
    assert.strictEqual(actor3.awoken, true);
  });

  test("should register and unregister actors", () => {
    const actor = createFakeActor({ name: "TestActor" });

    // @ts-expect-error
    sceneManager.registerActor(actor);
    // @ts-expect-error
    sceneManager.beginFrame();

    // Actor should be in cached actors (used for update/fixedUpdate)
    // @ts-expect-error
    sceneManager.update(kDeltaTime);
    assert.strictEqual(actor.update.mock.calls.length, 1);

    // @ts-expect-error
    sceneManager.unregisterActor(actor);
    // @ts-expect-error
    sceneManager.beginFrame();
    // @ts-expect-error
    sceneManager.update(kDeltaTime);

    // Should not have additional update calls after unregister
    assert.strictEqual(actor.update.mock.calls.length, 1);
  });

  test("should look up actor by name with getActor", () => {
    const actor1 = createFakeActor({ name: "Player" });
    const actor2 = createFakeActor({ name: "Enemy" });

    // @ts-expect-error
    sceneManager.registerActor(actor1);
    // @ts-expect-error
    sceneManager.registerActor(actor2);

    assert.strictEqual(sceneManager.getActor("Player"), actor1);
    assert.strictEqual(sceneManager.getActor("Enemy"), actor2);
    assert.strictEqual(sceneManager.getActor("NonExistent"), null);
  });

  test("should skip pending-destruction actors in getActor", () => {
    const actor = createFakeActor({
      name: "Player",
      pendingForDestruction: true
    });

    // @ts-expect-error
    sceneManager.registerActor(actor);

    assert.strictEqual(sceneManager.getActor("Player"), null);
  });

  test("should clean up name index on unregisterActor", () => {
    const actor = createFakeActor({ name: "Player" });

    // @ts-expect-error
    sceneManager.registerActor(actor);
    assert.strictEqual(sceneManager.getActor("Player"), actor);

    // @ts-expect-error
    sceneManager.unregisterActor(actor);
    assert.strictEqual(sceneManager.getActor("Player"), null);
  });

  test("should emit awake event", () => {
    let eventEmitted = false;
    sceneManager.on("awake", () => {
      eventEmitted = true;
    });

    sceneManager.awake();

    assert.strictEqual(eventEmitted, true);
    sceneManager.off("awake");
  });

  describe("beginFrame", () => {
    test("should start components for active actors", () => {
      const actor = createFakeActor({ name: "actor" });
      const component = createFakeComponent({ actor });

      // @ts-expect-error
      sceneManager.registerActor(actor);
      // @ts-expect-error
      sceneManager.componentsToBeStarted.push(component);

      sceneManager.beginFrame();

      assert.strictEqual(component.start.mock.calls.length, 1);
      assert.strictEqual(sceneManager.componentsToBeStarted.length, 0);
    });

    test("should skip components for inactive actors", () => {
      const inactiveActor = createFakeActor({ name: "inactive" });
      const component = createFakeComponent({ actor: inactiveActor });

      // @ts-expect-error
      sceneManager.componentsToBeStarted.push(component);

      sceneManager.beginFrame();

      assert.strictEqual(component.start.mock.calls.length, 0);
      assert.strictEqual(sceneManager.componentsToBeStarted.length, 1);
    });
  });

  describe("update", () => {
    test("should update all actors", () => {
      const actor1 = createFakeActor({ name: "actor1" });
      const actor2 = createFakeActor({ name: "actor2" });

      // @ts-expect-error
      sceneManager.registerActor(actor1);
      // @ts-expect-error
      sceneManager.registerActor(actor2);

      sceneManager.beginFrame();
      sceneManager.update(kDeltaTime);

      assert.strictEqual(actor1.update.mock.calls.length, 1);
      assert.strictEqual(actor1.update.mock.calls[0].arguments[0], kDeltaTime);
      assert.strictEqual(actor2.update.mock.calls.length, 1);
      assert.strictEqual(actor2.update.mock.calls[0].arguments[0], kDeltaTime);
    });

    test("should handle empty scene update", () => {
      assert.doesNotThrow(() => {
        sceneManager.beginFrame();
        sceneManager.update(kDeltaTime);
      });
    });
  });

  describe("fixedUpdate", () => {
    test("should call fixedUpdate on all actors", () => {
      const actor1 = createFakeActor({ name: "actor1" });
      const actor2 = createFakeActor({ name: "actor2" });

      // @ts-expect-error
      sceneManager.registerActor(actor1);
      // @ts-expect-error
      sceneManager.registerActor(actor2);

      sceneManager.beginFrame();
      sceneManager.fixedUpdate(kDeltaTime);

      assert.strictEqual(actor1.fixedUpdate.mock.calls.length, 1);
      assert.strictEqual(actor1.fixedUpdate.mock.calls[0].arguments[0], kDeltaTime);
      assert.strictEqual(actor2.fixedUpdate.mock.calls.length, 1);
      assert.strictEqual(actor2.fixedUpdate.mock.calls[0].arguments[0], kDeltaTime);
    });

    test("should handle empty scene fixedUpdate", () => {
      assert.doesNotThrow(() => {
        sceneManager.beginFrame();
        sceneManager.fixedUpdate(kDeltaTime);
      });
    });
  });

  describe("endFrame", () => {
    test("should destroy components marked for destruction", () => {
      const component1 = createFakeComponent();
      const component2 = createFakeComponent();

      // @ts-expect-error
      sceneManager.componentsToBeDestroyed.push(component1, component2);

      sceneManager.beginFrame();
      sceneManager.endFrame();

      assert.strictEqual(component1.destroy.mock.calls.length, 1);
      assert.strictEqual(component2.destroy.mock.calls.length, 1);
      assert.strictEqual(sceneManager.componentsToBeDestroyed.length, 0);
    });

    test("should destroy actors marked for destruction", () => {
      const actor = createFakeActor({
        name: "actor",
        pendingForDestruction: true
      });

      // @ts-expect-error
      sceneManager.registerActor(actor);

      sceneManager.beginFrame();
      sceneManager.endFrame();

      assert.strictEqual(actor.destroy.mock.calls.length, 1);
    });

    test("should handle nested actors with destruction", () => {
      const grandChild = createFakeActor({
        name: "grandChild"
      });
      const child1 = createFakeActor({
        children: [grandChild],
        name: "child1"
      });
      const child2 = createFakeActor({
        name: "child2"
      });
      const parent = createFakeActor({
        name: "parent",
        children: [child1, child2],
        pendingForDestruction: true
      });

      // @ts-expect-error
      sceneManager.registerActor(parent);
      // @ts-expect-error
      sceneManager.registerActor(child1);
      // @ts-expect-error
      sceneManager.registerActor(child2);
      // @ts-expect-error
      sceneManager.registerActor(grandChild);

      sceneManager.beginFrame();
      sceneManager.endFrame();

      assert.strictEqual(grandChild.destroy.mock.calls.length, 1);
      assert.strictEqual(child1.destroy.mock.calls.length, 1);
      assert.strictEqual(child2.destroy.mock.calls.length, 1);
      assert.strictEqual(parent.destroy.mock.calls.length, 1);
    });
  });

  describe("full frame lifecycle", () => {
    test("should snapshot once and reuse for fixedUpdate and update", () => {
      const actor = createFakeActor({ name: "actor" });

      // @ts-expect-error
      sceneManager.registerActor(actor);

      sceneManager.beginFrame();
      sceneManager.fixedUpdate(kDeltaTime);
      sceneManager.fixedUpdate(kDeltaTime);
      sceneManager.update(kDeltaTime);
      sceneManager.endFrame();

      assert.strictEqual(actor.fixedUpdate.mock.calls.length, 2);
      assert.strictEqual(actor.update.mock.calls.length, 1);
    });
  });

  test("should mark component for destruction", () => {
    const component = createFakeComponent();

    // @ts-expect-error
    sceneManager.componentsToBeStarted.push(component);
    // @ts-expect-error
    sceneManager.destroyComponent(component);

    assert.strictEqual(component.pendingForDestruction, true);
    // @ts-expect-error
    assert.ok(sceneManager.componentsToBeDestroyed.includes(component));
    assert.strictEqual(sceneManager.componentsToBeStarted.length, 0);
  });

  test("should not double-mark component for destruction", () => {
    const component = createFakeComponent({ pendingForDestruction: true });

    // @ts-expect-error
    sceneManager.destroyComponent(component);

    assert.strictEqual(sceneManager.componentsToBeDestroyed.length, 0);
  });

  test("should integrate with ActorTree callbacks", () => {
    const actor = createFakeActor({ name: "actor" });

    // @ts-expect-error
    sceneManager.tree.add(actor);

    assert.strictEqual(mockThreeScene.add.mock.calls.length, 1);
    assert.strictEqual(mockThreeScene.add.mock.calls[0].arguments[0], actor.object3D);

    // @ts-expect-error
    sceneManager.tree.remove(actor);

    assert.strictEqual(mockThreeScene.remove.mock.calls.length, 1);
    assert.strictEqual(mockThreeScene.remove.mock.calls[0].arguments[0], actor.object3D);
  });
});

interface FakeActorOptions {
  name?: string;
  children?: any[];
  awoken?: boolean;
  pendingForDestruction?: boolean;
}

function createFakeActor(
  options: FakeActorOptions
) {
  const {
    name = "TestActor",
    children = [],
    awoken = false,
    pendingForDestruction = false
  } = options;

  const actor = {
    name,
    children: [...children],
    awoken,
    pendingForDestruction,
    object3D: { id: Math.random() },
    awake: mock.fn(() => void 0),
    update: mock.fn(),
    fixedUpdate: mock.fn(),
    destroy: mock.fn(),
    isDestroyed: mock.fn(() => actor.pendingForDestruction),
    markDestructionPending: mock.fn()
  };

  return actor;
}

function createFakeComponent(
  options: { actor?: any; pendingForDestruction?: boolean; } = {}
) {
  const {
    actor = createFakeActor({ name: "component" }),
    pendingForDestruction = false
  } = options;

  return {
    actor,
    pendingForDestruction,
    start: mock.fn(),
    destroy: mock.fn()
  };
}
