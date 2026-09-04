// Import Internal Dependencies
import {
  FACE_AXIS,
  FACE_POSITIVE,
  type FACE,
  type Vec3
} from "../../utils/math.ts";

export interface FacePlacement {
  face: FACE;
  vertices: readonly Vec3[];
}

export function isBoundaryFace(
  placement: FacePlacement
): boolean {
  const { face, vertices } = placement;
  const axis = FACE_AXIS[face];
  const plane = FACE_POSITIVE[face] ? 1 : 0;

  for (const vertex of vertices) {
    if (vertex[axis] !== plane) {
      return false;
    }
  }

  return true;
}

export function defaultCullFace(
  placement: FacePlacement
): FACE | null {
  return isBoundaryFace(placement) ? placement.face : null;
}
