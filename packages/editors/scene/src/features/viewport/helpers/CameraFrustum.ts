// Import Third-party Dependencies
import * as THREE from "three";
import type { CameraComponent } from "@jolly-pixel/engine";

// Import Internal Dependencies
import {
  HELPER_MATERIAL,
  type ComponentHelper
} from "./ComponentHelper.ts";

// CONSTANTS
const kPreviewFar = 3;
const kPreviewAspect = 16 / 9;
const kCameraIcon = new THREE.BoxGeometry(0.3, 0.2, 0.4);

export class CameraFrustum implements ComponentHelper {
  readonly root = new THREE.Group();

  #component: CameraComponent;
  #perspective = new THREE.PerspectiveCamera();
  #orthographic = new THREE.OrthographicCamera();
  #frustum: THREE.CameraHelper | null = null;
  #icon = new THREE.Mesh(kCameraIcon, HELPER_MATERIAL);

  constructor(
    component: CameraComponent
  ) {
    this.#component = component;
    this.root.matrixAutoUpdate = false;
    this.root.add(this.#icon);
  }

  sync(): void {
    const component = this.#component;
    const camera = component.projectionMode === "orthographic" ?
      this.#orthographic :
      this.#perspective;
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = component.fov;
      camera.aspect = kPreviewAspect;
    }
    else {
      const halfHeight = component.orthographicScale / 2;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.left = -halfHeight * kPreviewAspect;
      camera.right = halfHeight * kPreviewAspect;
    }
    camera.near = component.near;
    camera.far = Math.min(component.far, component.near + kPreviewFar);
    camera.updateProjectionMatrix();

    if (this.#frustum?.camera !== camera) {
      this.#disposeFrustum();
      this.#frustum = new THREE.CameraHelper(camera);
      this.root.add(this.#frustum);
    }

    this.root.matrix.copy(component.actor.object3D.matrixWorld);
    this.root.matrixWorldNeedsUpdate = true;
    this.#frustum.update();
  }

  dispose(): void {
    this.#disposeFrustum();
  }

  #disposeFrustum(): void {
    if (this.#frustum !== null) {
      this.root.remove(this.#frustum);
      this.#frustum.dispose();
      this.#frustum = null;
    }
  }
}
