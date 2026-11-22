// Import Internal Dependencies
import type { FaceRanges } from "#src/runtime/mesh-texturing/types.ts";

// CONSTANTS
const kBoxFaceRanges: FaceRanges = {
  right: [{ start: 0, count: 4 }],
  left: [{ start: 4, count: 4 }],
  top: [{ start: 8, count: 4 }],
  bottom: [{ start: 12, count: 4 }],
  front: [{ start: 16, count: 4 }],
  back: [{ start: 20, count: 4 }]
};

export function boxFaceRanges(): FaceRanges {
  return { ...kBoxFaceRanges };
}
