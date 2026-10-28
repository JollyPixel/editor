// Import Third-party Dependencies
import {
  ActorComponents,
  Systems,
  type Actor
} from "@jolly-pixel/engine";
import * as THREE from "three";

// Import Internal Dependencies
import { makeLogger } from "./fakes.ts";

export interface FrameRequests {
  invalidations: number;
  keepAlives: Array<() => boolean>;
}

export function makeActor(
  frames: FrameRequests = { invalidations: 0, keepAlives: [] }
): Actor {
  const actor = {
    components: new ActorComponents(),
    object3D: new THREE.Group(),
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
        actors: new Systems.ActorRegistry(new THREE.Scene())
      }
    }
  };

  return actor as unknown as Actor;
}
