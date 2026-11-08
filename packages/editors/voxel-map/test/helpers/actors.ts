// Import Third-party Dependencies
import {
  ActorComponents,
  Systems,
  type Actor
} from "@jolly-pixel/engine";

export function sceneActor(): Actor {
  const graph = new Systems.ThreeSceneGraph();
  const actor: Record<string, unknown> = {
    components: new ActorComponents(),
    world: {
      invalidate: () => void 0,
      sceneManager: {
        actors: new Systems.ActorRegistry(graph),
        graph
      }
    }
  };
  actor.node = graph.createNode(actor as unknown as Actor);

  return actor as unknown as Actor;
}
