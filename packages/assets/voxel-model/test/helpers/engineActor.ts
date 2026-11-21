// Import Third-party Dependencies
import {
  ActorComponents,
  Systems,
  type Actor
} from "@jolly-pixel/engine";

export interface FrameRequests {
  invalidations: number;
}

export function makeActor(
  frames: FrameRequests = { invalidations: 0 }
): Actor {
  const graph = new Systems.ThreeSceneGraph();
  const actor: Record<string, unknown> = {
    components: new ActorComponents(),
    addComponentAndGet: (
      Component: new(actor: Actor, options: unknown) => unknown,
      options: unknown
    ) => new Component(actor as unknown as Actor, options),
    world: {
      invalidate: () => {
        frames.invalidations++;
      },
      sceneManager: {
        actors: new Systems.ActorRegistry(graph),
        graph
      }
    }
  };
  actor.node = graph.createNode(actor as unknown as Actor);

  return actor as unknown as Actor;
}
