// Import Third-party Dependencies
import type { CameraComponent } from "@jolly-pixel/backend.three";
import { CameraGizmo } from "@jolly-pixel/three";
import * as THREE from "three";

// Import Internal Dependencies
import type { ComponentHelper } from "./ComponentHelper.ts";

// CONSTANTS
const kCameraWorld = new THREE.Matrix4();

export class CameraFrustum implements ComponentHelper {
  readonly root = new CameraGizmo();

  #component: CameraComponent;

  constructor(
    component: CameraComponent
  ) {
    this.#component = component;
  }

  sync(): void {
    const component = this.#component;
    const {
      projectionMode,
      fov,
      near,
      far,
      orthographicScale
    } = component.settings;
    this.root.update(
      {
        projection: projectionMode,
        fov,
        near,
        far,
        orthographicScale
      },
      kCameraWorld.fromArray(component.actor.transform.global.matrix)
    );
  }

  dispose(): void {
    this.root.dispose();
  }
}
