// Import Internal Dependencies
import { FACE } from "../../../geometry/faceDirection.ts";
import type { BlockShapeID } from "../BlockShape.ts";
import { JunctionShape } from "./JunctionShape.ts";

export class PoleY extends JunctionShape {
  constructor(
    id: BlockShapeID = "poleY"
  ) {
    super(id, {
      min: [3 / 8, 3 / 8, 3 / 8],
      max: [5 / 8, 5 / 8, 5 / 8],
      arms: [FACE.NegY, FACE.PosY]
    });
  }
}
