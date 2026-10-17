// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach,
  mock
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { SceneManager } from "../../src/systems/scene/SceneManager.ts";

// CONSTANTS
const kDeltaTime = 16.67;

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
    parent: null as any,
    object3D: { id: Math.random() },
    awake: mock.fn(() => {
      actor.awoken = true;
    }),
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
    assert.strictEqual(scene.currentScene, null);
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
    sceneManager.beginFrame();

    sceneManager.update(kDeltaTime);
    assert.strictEqual(actor.update.mock.calls.length, 1);

    // @ts-expect-error
    sceneManager.unregisterActor(actor);
    sceneManager.beginFrame();
    sceneManager.update(kDeltaTime);

    assert.strictEqual(actor.update.mock.calls.length, 1);
  });

  test("should look up actor by name with getActor", () => {
    const actor1 = createFakeActor({ name: "Player" });
    const actor2 = createFakeActor({ name: "Enemy" });

    // @ts-expect-error
    sceneManager.tree.add(actor1);
    // @ts-expect-error
    sceneManager.tree.add(actor2);

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
    sceneManager.tree.add(actor);

    assert.strictEqual(sceneManager.getActor("Player"), null);
  });

  test("should stop finding an actor once it leaves the tree", () => {
    const actor = createFakeActor({ name: "Player" });

    // @ts-expect-error
    sceneManager.tree.add(actor);
    assert.strictEqual(sceneManager.getActor("Player"), actor);

    // @ts-expect-error
    sceneManager.tree.remove(actor);
    assert.strictEqual(sceneManager.getActor("Player"), null);
  });

  test("should emit awake event", () => {
    let eventEmitted = false;
    function awake() {
      eventEmitted = true;
    }
    sceneManager.on("awake", awake);

    sceneManager.awake();

    assert.strictEqual(eventEmitted, true);
    sceneManager.off("awake", awake);
  });

  describe("beginFrame", () => {
    test("should start components for active actors", () => {
      const actor = createFakeActor({ name: "actor" });
      const component = createFakeComponent({ actor });

      // @ts-expect-error
      sceneManager.registerActor(actor);
      // @ts-expect-error
      sceneManager.scheduleStart(component);

      sceneManager.beginFrame();
      sceneManager.beginFrame();

      assert.strictEqual(component.start.mock.calls.length, 1);
    });

    test("should defer components until their actor is registered", () => {
      const actor = createFakeActor({ name: "inactive" });
      const component = createFakeComponent({ actor });

      // @ts-expect-error
      sceneManager.scheduleStart(component);
      sceneManager.beginFrame();

      assert.strictEqual(component.start.mock.calls.length, 0);

      // @ts-expect-error
      sceneManager.registerActor(actor);
      sceneManager.beginFrame();

      assert.strictEqual(component.start.mock.calls.length, 1);
    });

    test("should awake actors registered after the scene was awoken", () => {
      const actor = createFakeActor({ name: "late" });

      // @ts-expect-error
      sceneManager.tree.add(actor);
      // @ts-expect-error
      sceneManager.registerActor(actor);
      sceneManager.beginFrame();
      sceneManager.beginFrame();

      assert.strictEqual(actor.awake.mock.calls.length, 1);
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
});
