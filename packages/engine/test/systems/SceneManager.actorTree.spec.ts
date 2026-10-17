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
