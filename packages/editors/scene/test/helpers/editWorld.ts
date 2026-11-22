// Import Third-party Dependencies
import {
  Actor,
  Systems
} from "@jolly-pixel/ecs";
import {
  ThreeSceneGraph
} from "@jolly-pixel/backend.three";

export interface EditWorld {
  world: Systems.World;
  sceneManager: Systems.SceneManager;
}

export function createEditWorld(): EditWorld {
  const world = {
    logger: new Systems.Logger(),
    sceneManager: null as unknown as Systems.SceneManager,
    invalidate: () => undefined,
    createActor(name: string) {
      return new Actor(world as unknown as Systems.World, { name });
    }
  };
  const sceneManager = new Systems.SceneManager(
    world as unknown as Systems.World,
    new ThreeSceneGraph()
  );
  world.sceneManager = sceneManager;

  return {
    world: world as unknown as Systems.World,
    sceneManager
  };
}
