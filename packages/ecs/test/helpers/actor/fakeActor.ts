// Import Node.js Dependencies
import { mock } from "node:test";

export interface FakeActorOptions {
  name?: string;
  children?: any[];
  awoken?: boolean;
  pendingForDestruction?: boolean;
}

export function createFakeActor(
  options: FakeActorOptions = {}
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
    markDestructionPending: mock.fn()
  };

  return actor;
}

export function createFakeComponent(
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
