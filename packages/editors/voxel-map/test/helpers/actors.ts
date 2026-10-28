// Import Third-party Dependencies
import * as THREE from "three";
import {
  ActorComponents,
  Systems,
  type Actor
} from "@jolly-pixel/engine";

export function sceneActor(): Actor {
  const object3D = new THREE.Group();

  return {
    components: new ActorComponents(),
    object3D,
    addChildren(...objects: THREE.Object3D[]) {
      object3D.add(...objects);

      return this;
    },
    world: {
      invalidate: () => void 0,
      sceneManager: {
        actors: new Systems.ActorRegistry(new THREE.Scene())
      }
    }
  } as unknown as Actor;
}
