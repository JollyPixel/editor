// Import Internal Dependencies
import type {
  BlockCollisionHint,
  BlockShape,
  BlockShapeID
} from "../../document/blocks/shape/BlockShape.ts";
import type { FaceDefinition } from "../../document/blocks/face/index.ts";
import type { FACE } from "../../document/geometry/faceDirection.ts";
import type { MeshShapeDefinition } from "./MeshDefinitions.ts";

export class DefinedShape implements BlockShape {
  readonly id: BlockShapeID;
  readonly faces: readonly FaceDefinition[];
  readonly collisionHint: BlockCollisionHint;

  #occludedFaces: number;

  constructor(
    definition: MeshShapeDefinition
  ) {
    this.id = definition.id;
    this.faces = definition.faces;
    this.collisionHint = definition.collisionHint;
    this.#occludedFaces = definition.occludedFaces;
  }

  occludes(
    face: FACE
  ): boolean {
    return (this.#occludedFaces & (1 << face)) !== 0;
  }
}
