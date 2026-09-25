// Import Internal Dependencies
import type {
  BlockVariant,
  BlockVariantFace
} from "../variants/types.ts";
import type { MeshPassOptions } from "../types.ts";
import { FACE_OFFSETS } from "../../utils/math.ts";
import { AO_UNOCCLUDED } from "../ambientOcclusion.ts";

export class FaceEmitter {
  #pass: MeshPassOptions;

  constructor(
    pass: MeshPassOptions
  ) {
    this.#pass = pass;
  }

  emitVisible(
    variant: BlockVariant,
    face: BlockVariantFace,
    wx: number,
    wy: number,
    wz: number
  ): void {
    const { cull } = face;
    if (cull >= 0) {
      const offset = FACE_OFFSETS[cull];
      const hidden = this.#pass.neighbourhood.isNeighbourFaceHidden(
        wx + offset[0],
        wy + offset[1],
        wz + offset[2],
        variant,
        face
      );
      if (hidden) {
        this.#pass.stats.culledFaces++;

        return;
      }
    }

    this.emit(variant, face, wx, wy, wz);
  }

  emit(
    variant: BlockVariant,
    face: BlockVariantFace,
    wx: number,
    wy: number,
    wz: number
  ): void {
    const {
      neighbourhood,
      stats,
      bufferFor,
      ambientOcclusion
    } = this.#pass;
    const ao = ambientOcclusion ?
      neighbourhood.ambientOcclusionAt(face.cull, wx, wy, wz) :
      AO_UNOCCLUDED;

    if (!face.splittable) {
      bufferFor(face.slot).addFace(face, wx, wy, wz, ao);
      stats.faces++;

      return;
    }

    const pieces = neighbourhood.boundaryFaces(face, wx, wy, wz, variant);
    for (const piece of pieces) {
      bufferFor(piece.slot).addFace(piece, wx, wy, wz, ao);
      stats.faces++;
    }
  }
}
