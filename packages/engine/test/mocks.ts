// Import Node.js Dependencies
import { mock } from "node:test";

// Import Internal Dependencies
import { ActorComponent, Behavior } from "../src/index.ts";

export function createActor(): {
  behaviors: Record<string, Behavior[]>;
  components: ActorComponent[];
  gameInstance: ReturnType<typeof createGameInstance>;
} {
  return {
    behaviors: {},
    components: [],
    gameInstance: createGameInstance()
  };
}

export function createTreeActor() {
  return {
    add: mock.fn(),
    remove: mock.fn()
  };
}

export function createGameInstance(): {
  scene: {
    componentsToBeStarted: ActorComponent[];
    tree: ReturnType<typeof createTreeActor>;
  };
} {
  return {
    scene: {
      componentsToBeStarted: [],
      tree: createTreeActor()
    }
  };
}
