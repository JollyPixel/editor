// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type { FaceRanges } from "../../../src/three/faceRanges.ts";

// CONSTANTS
export const PREVIEW_SHAPE_SIZE = 1.5;

export interface PreviewShape {
  geometry: THREE.BufferGeometry;
  faceRanges: FaceRanges;
  decorations: THREE.Object3D[];
}
