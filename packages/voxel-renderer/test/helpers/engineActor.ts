// Import Third-party Dependencies
import type { Actor } from "@jolly-pixel/engine";
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
    components: [],
    componentsRequiringUpdate: [],
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
        scheduleStart: () => void 0,
        cancelStart: () => void 0
      }
    }
  };

  return actor as unknown as Actor;
}
