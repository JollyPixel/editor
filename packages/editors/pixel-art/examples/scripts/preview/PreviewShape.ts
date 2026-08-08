// Import Third-party Dependencies
import type * as THREE from "three";
import type { UVFace } from "@jolly-pixel/pixel-draw.renderer";

// CONSTANTS
export const PREVIEW_SHAPE_SIZE = 1.5;

export interface FaceVertexRange {
  start: number;
  count: number;
}

export interface PreviewShape {
  geometry: THREE.BufferGeometry;
  faceRanges: Partial<Record<UVFace, FaceVertexRange>>;
  decorations: THREE.Object3D[];
}
