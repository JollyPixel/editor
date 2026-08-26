// Import Third-party Dependencies
import type { UVFace } from "@jolly-pixel/pixel-draw.renderer";

/**
 * Contiguous vertex range; counts are vertices, not floats.
 */
export interface FaceVertexRange {
  start: number;
  count: number;
}

export type FaceRanges = Partial<Record<UVFace, FaceVertexRange>>;

// CONSTANTS
// THREE.BoxGeometry emits its six faces in this order, four vertices each.
const kBoxFaceRanges: FaceRanges = {
  right: { start: 0, count: 4 },
  left: { start: 4, count: 4 },
  top: { start: 8, count: 4 },
  bottom: { start: 12, count: 4 },
  front: { start: 16, count: 4 },
  back: { start: 20, count: 4 }
};

const kRampFaceRanges: FaceRanges = {
  bottom: { start: 0, count: 4 },
  back: { start: 4, count: 4 },
  left: { start: 8, count: 3 },
  right: { start: 11, count: 3 },
  top: { start: 14, count: 4 }
};

/**
 * Vertex ranges for a one-segment `THREE.BoxGeometry`.
 */
export function boxFaceRanges(): FaceRanges {
  return { ...kBoxFaceRanges };
}

/**
 * Vertex ranges for a box with one corner removed.
 */
export function rampFaceRanges(): FaceRanges {
  return { ...kRampFaceRanges };
}
