// Import Third-party Dependencies
import {
  Actor,
  Systems
} from "@jolly-pixel/engine";

export interface EditWorld {
  world: Systems.World;
  sceneManager: Systems.SceneManager;
}

export function createEditWorld(): EditWorld {
  const sceneManager = new Systems.SceneManager();
  const world = {
    logger: new Systems.Logger(),
    sceneManager,
    invalidate: () => undefined,
    createActor(name: string) {
      return new Actor(world as unknown as Systems.World, { name });
    }
  };
  sceneManager.bindWorld(world as unknown as Systems.World);

  return {
    world: world as unknown as Systems.World,
    sceneManager
  };
}
