// Import Internal Dependencies
import {
  FACES,
  FACE_AXIS,
  type Vec3
} from "../../utils/math.ts";
import {
  isBoundaryFace,
  type FaceDefinition
} from "../face/index.ts";

// CONSTANTS
const kCoverageEpsilon = 1e-9;

export function occlusionMaskOf(
  faces: readonly FaceDefinition[]
): number {
  const coverage = new Float64Array(FACES.length);

  for (const definition of faces) {
    if (!isBoundaryFace(definition)) {
      continue;
    }

    coverage[definition.face] += planarArea(
      definition.vertices,
      FACE_AXIS[definition.face]
    );
  }

  let mask = 0;
  for (const face of FACES) {
    if (coverage[face] >= 1 - kCoverageEpsilon) {
      mask |= 1 << face;
    }
  }

  return mask;
}

function planarArea(
  vertices: readonly Vec3[],
  axis: number
): number {
  const u = axis === 0 ? 1 : 0;
  const v = axis === 2 ? 1 : 2;

  let twiceArea = 0;
  for (let index = 0; index < vertices.length; index++) {
    const current = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    twiceArea += (current[u] * next[v]) - (next[u] * current[v]);
  }

  return Math.abs(twiceArea) / 2;
}
