// Import Third-party Dependencies
import type * as THREE from "three";
import type { FaceRanges } from "@jolly-pixel/asset.pixel-art/runtime";

// CONSTANTS
export const PREVIEW_SHAPE_SIZE = 1.5;

export interface PreviewShape {
  geometry: THREE.BufferGeometry;
  faceRanges: FaceRanges;
  decorations: THREE.Object3D[];
}
