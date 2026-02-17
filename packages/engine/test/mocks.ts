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

export function createWorld(): {
  sceneManager: {
    componentsToBeStarted: ActorComponent[];
    tree: ReturnType<typeof createTreeActor>;
  };
} {
  return {
    sceneManager: {
      componentsToBeStarted: [],
      tree: createTreeActor()
    }
  };
}
