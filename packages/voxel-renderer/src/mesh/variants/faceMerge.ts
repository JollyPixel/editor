// Import Internal Dependencies
import type {
  BlockFaceMerge,
  BlockVariantFace
} from "./types.ts";

/**
 * Selects at most one stretchable face per world-space direction.
 */
export function indexMergeFaces(
  faces: BlockVariantFace[]
): (BlockVariantFace | undefined)[] {
  const mergeFaces = new Array<BlockVariantFace | undefined>(6).fill(undefined);

  for (const face of faces) {
    if (face.merge === null) {
      continue;
    }

    if (mergeFaces[face.cull] === undefined) {
      mergeFaces[face.cull] = face;
    }
    else {
      face.merge = null;
    }
  }

  return mergeFaces;
}

/**
 * Maps a full boundary quad onto world axes, or rejects it as unmergeable.
 */
export function describeMerge(
  cull: number,
  positions: Float32Array,
  tileUvs: Float32Array
): BlockFaceMerge | null {
  if (positions.length !== 12 || cull < 0) {
    return null;
  }

  // FACE packs direction as `axis * 2 + (negative ? 1 : 0)`.
  const axis = cull >> 1;
  const plane = (cull & 1) === 0 ? 1 : 0;
  const uAxis = axis === 0 ? 1 : 0;
  const vAxis = axis === 2 ? 1 : 2;

  // Bit `(v << 1) | u` per visited corner; all four must show up exactly once
  // in both position and tile space.
  let cornerMask = 0;
  let uvMask = 0;

  for (let i = 0; i < 4; i++) {
    if (positions[(i * 3) + axis] !== plane) {
      return null;
    }

    const pu = positions[(i * 3) + uAxis];
    const pv = positions[(i * 3) + vAxis];
    const tu = tileUvs[i * 2];
    const tv = tileUvs[(i * 2) + 1];
    if (!isCorner(pu) || !isCorner(pv) || !isCorner(tu) || !isCorner(tv)) {
      return null;
    }

    cornerMask |= 1 << ((pv << 1) | pu);
    uvMask |= 1 << ((tv << 1) | tu);
  }

  if (cornerMask !== 0b1111 || uvMask !== 0b1111) {
    return null;
  }

  // Walk from corner 0 to the corner reached by moving along uAxis alone: the
  // tile coordinate that changes there is the one that follows uAxis.
  for (let i = 1; i < 4; i++) {
    if (
      positions[(i * 3) + vAxis] === positions[vAxis] &&
      positions[(i * 3) + uAxis] !== positions[uAxis]
    ) {
      return {
        axis,
        uAxis,
        vAxis,
        swapped: tileUvs[i * 2] === tileUvs[0]
      };
    }
  }

  return null;
}

function isCorner(
  value: number
): boolean {
  return value === 0 || value === 1;
}
