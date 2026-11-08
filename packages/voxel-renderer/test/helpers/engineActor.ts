// Import Third-party Dependencies
import {
  ActorComponents,
  Systems,
  type Actor
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import { makeLogger } from "./fakes.ts";

export interface FrameRequests {
  invalidations: number;
  keepAlives: Array<() => boolean>;
}

export function makeActor(
  frames: FrameRequests = { invalidations: 0, keepAlives: [] }
): Actor {
  const graph = new Systems.ThreeSceneGraph();
  const actor: Record<string, unknown> = {
    components: new ActorComponents(),
    addComponentAndGet: (
      Component: new(actor: Actor, options: unknown) => unknown,
      options: unknown
    ) => new Component(actor as unknown as Actor, options),
    world: {
      logger: makeLogger(),
      invalidate: () => {
        frames.invalidations++;
      },
      keepAlive: (predicate: () => boolean) => {
        frames.keepAlives.push(predicate);

        return () => {
          frames.keepAlives.splice(frames.keepAlives.indexOf(predicate), 1);
        };
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
