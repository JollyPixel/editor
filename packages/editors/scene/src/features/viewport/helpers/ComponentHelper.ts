// Import Third-party Dependencies
import * as THREE from "three";

// CONSTANTS
export const HELPER_COLOR = "#f5c46b";
export const HELPER_MATERIAL = new THREE.MeshBasicMaterial({
  color: HELPER_COLOR,
  wireframe: true
});

export interface ComponentHelper {
  readonly root: THREE.Object3D;
  sync(): void;
  dispose(): void;
}
