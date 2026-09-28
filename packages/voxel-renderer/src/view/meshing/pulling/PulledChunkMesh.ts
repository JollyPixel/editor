// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { PulledChunkGeometry } from "./PulledChunkGeometry.ts";

export class PulledChunkMesh extends THREE.Mesh<
  PulledChunkGeometry,
  THREE.Material
> {
  override raycast(
    raycaster: THREE.Raycaster,
    intersects: THREE.Intersection[]
  ): void {
    this.geometry.raycastMesh(this, raycaster, intersects);
  }
}
