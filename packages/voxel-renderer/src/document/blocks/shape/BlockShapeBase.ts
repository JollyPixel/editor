// Import Internal Dependencies
import type { FACE } from "../../geometry/faceDirection.ts";
import type { FaceDefinition } from "../face/index.ts";
import type {
  BlockCollisionHint,
  BlockShape,
  BlockShapeID
} from "./BlockShape.ts";
import { computeOcclusionMask } from "./shapeOcclusion.ts";

export abstract class BlockShapeBase implements BlockShape {
  abstract readonly id: BlockShapeID;
  abstract readonly faces: readonly FaceDefinition[];
  abstract readonly collisionHint: BlockCollisionHint;

  #occlusionMask: number | null = null;

  occludes(
    face: FACE
  ): boolean {
    this.#occlusionMask ??= computeOcclusionMask(this.faces);

    return (this.#occlusionMask & (1 << face)) !== 0;
  }
}
