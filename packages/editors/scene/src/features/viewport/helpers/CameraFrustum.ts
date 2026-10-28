// Import Third-party Dependencies
import type { CameraComponent } from "@jolly-pixel/engine";
import { CameraGizmo } from "@jolly-pixel/three";

// Import Internal Dependencies
import type { ComponentHelper } from "./ComponentHelper.ts";

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
      component.actor.object3D.matrixWorld
    );
  }

  dispose(): void {
    this.root.dispose();
  }
}
