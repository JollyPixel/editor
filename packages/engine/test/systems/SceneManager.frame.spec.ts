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
import { Actor, ActorComponent } from "../../src/actor/index.ts";

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

class UpdatingComponent extends ActorComponent {
  constructor(
    actor: Actor
  ) {
    super({ actor, typeName: "Updating" });
  }

  update() {
    return;
  }
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
      sceneManager.destroyComponent(component1);
      // @ts-expect-error
      sceneManager.destroyComponent(component2);

      sceneManager.beginFrame();
      sceneManager.endFrame();
      sceneManager.endFrame();

      assert.strictEqual(component1.destroy.mock.calls.length, 1);
      assert.strictEqual(component2.destroy.mock.calls.length, 1);
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

    test("should destroy only the root of a pending subtree", () => {
      const grandChild = createFakeActor({
        name: "grandChild",
        pendingForDestruction: true
      });
      const child1 = createFakeActor({
        children: [grandChild],
        name: "child1",
        pendingForDestruction: true
      });
      const child2 = createFakeActor({
        name: "child2",
        pendingForDestruction: true
      });
      const parent = createFakeActor({
        name: "parent",
        children: [child1, child2],
        pendingForDestruction: true
      });
      child1.parent = parent;
      child2.parent = parent;
      grandChild.parent = child1;

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

      assert.strictEqual(grandChild.destroy.mock.calls.length, 0);
      assert.strictEqual(child1.destroy.mock.calls.length, 0);
      assert.strictEqual(child2.destroy.mock.calls.length, 0);
      assert.strictEqual(parent.destroy.mock.calls.length, 1);
    });

    test("should destroy each actor of a real subtree exactly once", () => {
      const realSceneManager = new SceneManager();
      const world = { sceneManager: realSceneManager };
      const parent = new Actor(world as any, { name: "parent" });
      const child = new Actor(world as any, { name: "child", parent });
      const grandChild = new Actor(world as any, { name: "grandChild", parent: child });
      const destroyCalls = [parent, child, grandChild].map((actor) => mock.method(actor, "destroy"));

      realSceneManager.beginFrame();
      realSceneManager.tree.destroyActor(parent);
      realSceneManager.endFrame();

      assert.deepEqual(destroyCalls.map((call) => call.mock.callCount()), [1, 1, 1]);
      assert.strictEqual(realSceneManager.getActor("parent"), null);
    });

    test("should tear down a component marked for destruction", () => {
      const realSceneManager = new SceneManager();
      const world = { sceneManager: realSceneManager };
      const actor = new Actor(world as any, { name: "owner" });
      const component = actor.addComponentAndGet(UpdatingComponent);

      realSceneManager.destroyComponent(component);
      realSceneManager.endFrame();

      assert.deepEqual(actor.components, []);
      assert.deepEqual(actor.componentsRequiringUpdate, []);
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

  test("should mark component for destruction and cancel its start", () => {
    const actor = createFakeActor({ name: "owner" });
    const component = createFakeComponent({ actor });

    // @ts-expect-error
    sceneManager.registerActor(actor);
    // @ts-expect-error
    sceneManager.scheduleStart(component);
    // @ts-expect-error
    sceneManager.destroyComponent(component);
    sceneManager.beginFrame();

    assert.strictEqual(component.pendingForDestruction, true);
    assert.strictEqual(component.start.mock.calls.length, 0);
  });

  test("should not double-mark component for destruction", () => {
    const component = createFakeComponent({ pendingForDestruction: true });

    // @ts-expect-error
    sceneManager.destroyComponent(component);
    sceneManager.endFrame();

    assert.strictEqual(component.destroy.mock.calls.length, 0);
  });
});
