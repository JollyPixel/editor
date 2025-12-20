// Import Node.js Dependencies
import { describe, test, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { SceneEngine } from "../../src/systems/Scene.ts";

// CONSTANTS
const kDeltaTime = 16.67;

describe("Systems.SceneEngine", () => {
  let sceneEngine: SceneEngine;
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
    sceneEngine = new SceneEngine(mockThreeScene);
  });

  test("should initialize with default values", () => {
    const scene = new SceneEngine();

    assert.ok(scene.tree);
    assert.ok(Array.isArray(scene.componentsToBeStarted));
    assert.ok(Array.isArray(scene.componentsToBeDestroyed));
    assert.strictEqual(scene.componentsToBeStarted.length, 0);
    assert.strictEqual(scene.componentsToBeDestroyed.length, 0);
  });

  test("should use provided THREE.Scene", () => {
    const result = sceneEngine.getSource();

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
    sceneEngine.tree.children.push(actor1, actor2, actor3);

    sceneEngine.awake();

    assert.strictEqual(actor1.awake.mock.calls.length, 1);
    assert.strictEqual(actor2.awake.mock.calls.length, 0);
    assert.strictEqual(actor3.awake.mock.calls.length, 1);
    assert.strictEqual(actor1.awoken, true);
    assert.strictEqual(actor3.awoken, true);
  });

  test("should emit awake event", () => {
    let eventEmitted = false;
    sceneEngine.on("awake", () => {
      eventEmitted = true;
    });

    sceneEngine.awake();

    assert.strictEqual(eventEmitted, true);
    sceneEngine.off("awake");
  });

  test("should start components for active actors", () => {
    const actor = createFakeActor({ name: "actor" });
    const component = createFakeComponent({ actor });

    // @ts-expect-error
    sceneEngine.tree.children.push(actor);
    // @ts-expect-error
    sceneEngine.componentsToBeStarted.push(component);

    sceneEngine.update(kDeltaTime);

    assert.strictEqual(component.start.mock.calls.length, 1);
    assert.strictEqual(sceneEngine.componentsToBeStarted.length, 0);
  });

  test("should skip components for inactive actors", () => {
    const inactiveActor = createFakeActor({ name: "inactive" });
    const component = createFakeComponent({ actor: inactiveActor });

    // @ts-expect-error
    sceneEngine.componentsToBeStarted.push(component);

    sceneEngine.update(kDeltaTime);

    assert.strictEqual(component.start.mock.calls.length, 0);
    assert.strictEqual(sceneEngine.componentsToBeStarted.length, 1);
  });

  test("should update all actors", () => {
    const actor1 = createFakeActor({ name: "actor1" });
    const actor2 = createFakeActor({ name: "actor2" });

    // @ts-expect-error
    sceneEngine.tree.children.push(actor1, actor2);

    sceneEngine.update(kDeltaTime);

    assert.strictEqual(actor1.update.mock.calls.length, 1);
    assert.strictEqual(actor1.update.mock.calls[0].arguments[0], kDeltaTime);
    assert.strictEqual(actor2.update.mock.calls.length, 1);
    assert.strictEqual(actor2.update.mock.calls[0].arguments[0], kDeltaTime);
  });

  test("should destroy components marked for destruction", () => {
    const component1 = createFakeComponent();
    const component2 = createFakeComponent();

    // @ts-expect-error
    sceneEngine.componentsToBeDestroyed.push(component1, component2);

    sceneEngine.update(kDeltaTime);

    assert.strictEqual(component1.destroy.mock.calls.length, 1);
    assert.strictEqual(component2.destroy.mock.calls.length, 1);
    assert.strictEqual(sceneEngine.componentsToBeDestroyed.length, 0);
  });

  test("should destroy actors marked for destruction", () => {
    const actor = createFakeActor({
      name: "actor",
      pendingForDestruction: true
    });

    // @ts-expect-error
    sceneEngine.tree.children.push(actor);

    sceneEngine.update(kDeltaTime);

    assert.strictEqual(actor.destroy.mock.calls.length, 1);
  });

  test("should mark component for destruction", () => {
    const component = createFakeComponent();

    // @ts-expect-error
    sceneEngine.componentsToBeStarted.push(component);
    // @ts-expect-error
    sceneEngine.destroyComponent(component);

    assert.strictEqual(component.pendingForDestruction, true);
    // @ts-expect-error
    assert.ok(sceneEngine.componentsToBeDestroyed.includes(component));
    assert.strictEqual(sceneEngine.componentsToBeStarted.length, 0);
  });

  test("should not double-mark component for destruction", () => {
    const component = createFakeComponent({ pendingForDestruction: true });

    // @ts-expect-error
    sceneEngine.destroyComponent(component);

    assert.strictEqual(sceneEngine.componentsToBeDestroyed.length, 0);
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
    sceneEngine.tree.children.push(parent);

    sceneEngine.update(kDeltaTime);

    assert.strictEqual(grandChild.destroy.mock.calls.length, 1);
    assert.strictEqual(child1.destroy.mock.calls.length, 1);
    assert.strictEqual(child2.destroy.mock.calls.length, 1);
    assert.strictEqual(parent.destroy.mock.calls.length, 1);
  });

  test("should handle empty scene update", () => {
    assert.doesNotThrow(() => {
      sceneEngine.update(kDeltaTime);
    });
  });

  test("should integrate with ActorTree callbacks", () => {
    const actor = createFakeActor({ name: "actor" });

    // @ts-expect-error
    sceneEngine.tree.add(actor);

    assert.strictEqual(mockThreeScene.add.mock.calls.length, 1);
    assert.strictEqual(mockThreeScene.add.mock.calls[0].arguments[0], actor.threeObject);

    // @ts-expect-error
    sceneEngine.tree.remove(actor);

    assert.strictEqual(mockThreeScene.remove.mock.calls.length, 1);
    assert.strictEqual(mockThreeScene.remove.mock.calls[0].arguments[0], actor.threeObject);
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
    threeObject: { id: Math.random() },
    awake: mock.fn(() => void 0),
    update: mock.fn(),
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
