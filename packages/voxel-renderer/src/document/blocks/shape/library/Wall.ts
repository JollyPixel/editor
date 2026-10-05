// Import Internal Dependencies
import type { Vec3 } from "../../../geometry/faceDirection.ts";
import type { BlockShapeID } from "../BlockShape.ts";
import {
  JUNCTION_ARMS,
  JUNCTION_ID_SUFFIX,
  type JunctionType
} from "./junctionArms.ts";
import { JunctionShape } from "./JunctionShape.ts";

export type WallType = Exclude<JunctionType, "end">;

// CONSTANTS
const kMin: Vec3 = [3 / 8, 0, 3 / 8];
const kMax: Vec3 = [5 / 8, 1, 5 / 8];

export class Wall extends JunctionShape {
  constructor(
    type: WallType = "straight",
    id?: BlockShapeID
  ) {
    super(id ?? `wall${JUNCTION_ID_SUFFIX[type]}`, {
      min: kMin,
      max: kMax,
      arms: JUNCTION_ARMS[type]
    });
  }
}
