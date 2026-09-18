// Import Node.js Dependencies
import { mock } from "node:test";

// Import Internal Dependencies
import { ActorComponent, Behavior } from "../src/index.ts";

export function createActor(): {
  behaviors: Record<string, Behavior[]>;
  components: ActorComponent[];
  componentsRequiringUpdate: ActorComponent[];
  world: ReturnType<typeof createWorld>;
} {
  return {
    behaviors: {},
    components: [],
    componentsRequiringUpdate: [],
    world: createWorld()
  };
}

export function createTreeActor() {
  return {
    add: mock.fn(),
    remove: mock.fn()
  };
}

export function createSceneManager() {
  const componentsToStart: unknown[] = [];

  return {
    componentsToStart,
    scheduleStart: mock.fn((component: unknown) => {
      componentsToStart.push(component);
    }),
    cancelStart: mock.fn((component: unknown) => {
      const index = componentsToStart.indexOf(component);
      if (index !== -1) {
        componentsToStart.splice(index, 1);
      }
    }),
    tree: createTreeActor(),
    registerActor: mock.fn(),
    unregisterActor: mock.fn()
  };
}

export function createWorld() {
  return {
    sceneManager: createSceneManager()
  };
}
