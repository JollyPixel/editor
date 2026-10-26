// Import Third-party Dependencies
import type * as THREE from "three";

export interface ComponentHelper {
  readonly root: THREE.Object3D;
  sync(): void;
  dispose(): void;
}
