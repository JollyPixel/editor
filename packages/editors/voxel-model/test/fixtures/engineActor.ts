// Import Third-party Dependencies
import {
  ActorComponents,
  Systems,
  type Actor
} from "@jolly-pixel/engine";
import * as THREE from "three";

export interface FrameRequests {
  invalidations: number;
}

export function makeActor(
  frames: FrameRequests = { invalidations: 0 }
): Actor {
  const actor = {
    components: new ActorComponents(),
    object3D: new THREE.Group(),
    addComponentAndGet: (
      Component: new(actor: Actor, options: unknown) => unknown,
      options: unknown
    ) => new Component(actor as unknown as Actor, options),
    world: {
      invalidate: () => {
        frames.invalidations++;
      },
      sceneManager: {
        actors: new Systems.ActorRegistry(new THREE.Scene())
      }
    }
  };

  return actor as unknown as Actor;
}
