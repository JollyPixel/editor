// Import Internal Dependencies
import { Actor } from "../../../src/actor/index.ts";
import { createHeadlessWorld } from "../world/headlessWorld.ts";

export function createRegistry() {
  const world = createHeadlessWorld();
  const { sceneManager } = world;

  return {
    world,
    registry: sceneManager.actors,
    createActor(name: string, parent: Actor | null = null) {
      return new Actor(world, { name, parent });
    }
  };
}
