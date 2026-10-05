// Import Internal Dependencies
import { FACE } from "../../../geometry/faceDirection.ts";
import type { BlockShapeID } from "../BlockShape.ts";
import { JunctionShape } from "./JunctionShape.ts";

export class StairCornerPeak extends JunctionShape {
  constructor(
    id: BlockShapeID = "stairCornerPeak"
  ) {
    super(id, {
      min: [0, 0, 0],
      max: [0.5, 0.5, 0.5],
      arms: [FACE.PosX, FACE.PosY, FACE.PosZ]
    });
  }
}
