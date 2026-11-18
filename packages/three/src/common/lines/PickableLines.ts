// Import Third-party Dependencies
import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/webgpu/LineSegments2.js";

export class PickableLines extends LineSegments2 {
  override raycast(
    raycaster: THREE.Raycaster,
    intersects: THREE.Intersection[]
  ): void {
    if (raycaster.camera instanceof THREE.Camera) {
      super.raycast(raycaster, intersects);
    }
  }
}

export class UnpickableLines extends LineSegments2 {
  override raycast(): void {
    return;
  }
}
