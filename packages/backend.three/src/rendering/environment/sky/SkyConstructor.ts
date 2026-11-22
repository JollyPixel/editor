// Import Third-party Dependencies
import type * as THREE from "three/webgpu";

export interface SkyConstructor {
  new (direction: THREE.Vector3): { readonly node: THREE.Node; };
}
