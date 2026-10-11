// Import Internal Dependencies
import type {
  BlockVariant,
  BlockVariantFace
} from "./variants/types.ts";
import type { ChunkMeshPass } from "./ChunkMesher.ts";
import { FACE_OFFSETS } from "../../document/geometry/faceDirection.ts";
import { AO_UNOCCLUDED } from "./ambientOcclusion.ts";
import {
  FACE_BLEND_OFFSETS,
  type FaceBlendNeighbours
} from "./faceBlend.ts";

export class FaceEmitter {
  #pass: ChunkMeshPass;
  // oxlint-disable-next-line unicorn/no-new-array
  #neighbours: FaceBlendNeighbours = new Array(FACE_BLEND_OFFSETS.length)
    .fill(null);
  #position: [number, number, number] = [0, 0, 0];

  constructor(
    pass: ChunkMeshPass
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
      resolveFaceBuffer,
      ambientOcclusion
    } = this.#pass;
    const ao = ambientOcclusion ?
      neighbourhood.ambientOcclusionAt(face.cull, wx, wy, wz) :
      AO_UNOCCLUDED;

    if (!face.splittable) {
      const position = this.#position;
      position[0] = wx;
      position[1] = wy;
      position[2] = wz;
      const blended = variant.blend !== null && neighbourhood.blendNeighboursAt(
        variant,
        face,
        position,
        this.#neighbours
      );
      resolveFaceBuffer(face.slot, blended)
        .addFace(face, wx, wy, wz, ao, blended ? this.#neighbours : undefined);
      stats.faces++;

      return;
    }

    const pieces = neighbourhood.boundaryFaces(face, wx, wy, wz, variant);
    for (const piece of pieces) {
      resolveFaceBuffer(piece.slot).addFace(piece, wx, wy, wz, ao);
      stats.faces++;
    }
  }
}
