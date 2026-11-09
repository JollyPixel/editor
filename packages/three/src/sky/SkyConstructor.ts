// Import Third-party Dependencies
import type * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { SkyBackdrop } from "./SkyBackdrop.ts";

export interface SkyConstructor {
  readonly backdrop: SkyBackdrop;
  new (direction: THREE.Vector3): { readonly node: THREE.Node; };
}
