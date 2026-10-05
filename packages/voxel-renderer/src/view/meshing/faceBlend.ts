// Import Internal Dependencies
import type {
  BlendGroup,
  BlendPattern
} from "../../document/materials/BlendGroup.ts";
import { FACE } from "../../document/geometry/faceDirection.ts";
import type { BlockVariantFace } from "./variants/types.ts";

/**
 * In-plane `[du, dv]` offsets of the blend neighbours, in the order their
 * palette indices are packed: four edges, then four corners. `u` and `v`
 * are the face's AO axes.
 */
export const FACE_BLEND_OFFSETS: readonly (readonly [du: number, dv: number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1]
];

export interface FaceBlendNeighbour {
  /**
   * Unsigned-normalized atlas rect of the neighbour's matching face.
   */
  region: Uint16Array;
  group: BlendGroup;
  /**
   * Edge strength from `BlendGroup.bleedOnto`, 0.5 or 1.
   */
  strength: number;
  /**
   * Whether this face reads the pattern inverted. On a shared edge one side
   * does, so both sides trace the same wavy border.
   */
  inverted: boolean;
}

export type FaceBlendNeighbours = (FaceBlendNeighbour | null)[];

export const BLEND_PATTERN_CODES: Readonly<Record<BlendPattern, number>> = {
  noise: 0,
  bayer: 1
};

export function blendsFace(
  face: Pick<BlockVariantFace, "cull">
): boolean {
  return face.cull === FACE.PosY || face.cull === FACE.NegY;
}

export interface FaceBlendMatch {
  face: BlockVariantFace;
  neighbour: FaceBlendNeighbour;
}
