// Import Third-party Dependencies
import * as THREE from "three";
import type { Actor } from "@jolly-pixel/engine";

export function sceneActor(): Actor {
  const object3D = new THREE.Group();

  return {
    components: [],
    componentsRequiringUpdate: [],
    object3D,
    addChildren(...objects: THREE.Object3D[]) {
      object3D.add(...objects);

      return this;
    },
    world: {
      invalidate: () => void 0,
      sceneManager: {
        scheduleStart: () => void 0,
        cancelStart: () => void 0
      }
    }
  } as unknown as Actor;
}
