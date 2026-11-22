// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/ecs";

// Import Internal Dependencies
import { ThreeSceneGraph } from "../../../src/scene/ThreeSceneGraph.ts";

export function fakeWorld<T extends object>(
  fields: T = {} as T,
  graph: Systems.SceneGraph = new ThreeSceneGraph()
): T & { sceneManager: Systems.SceneManager; } {
  const world = {
    logger: new Systems.Logger(),
    ...fields,
    sceneManager: null as unknown as Systems.SceneManager
  };
  world.sceneManager = new Systems.SceneManager(world as any, graph);

  return world;
}
