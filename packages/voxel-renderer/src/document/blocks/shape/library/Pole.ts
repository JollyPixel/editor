// Import Internal Dependencies
import {
  FACE,
  type Vec3
} from "../../../geometry/faceDirection.ts";
import type { BlockShapeID } from "../BlockShape.ts";
import {
  JUNCTION_ARMS,
  JUNCTION_ID_SUFFIX,
  type JunctionType
} from "./junctionArms.ts";
import { JunctionShape } from "./JunctionShape.ts";

export type PoleType = Exclude<JunctionType, "end">;
export type PoleRise =
  | "none"
  | "up"
  | "through";

// CONSTANTS
const kMin: Vec3 = [3 / 8, 3 / 8, 3 / 8];
const kMax: Vec3 = [5 / 8, 5 / 8, 5 / 8];
const kRiseArms: Record<PoleRise, readonly FACE[]> = {
  none: [],
  up: [FACE.PosY],
  through: [FACE.NegY, FACE.PosY]
};
const kRiseIdSuffix: Record<PoleRise, string> = {
  none: "",
  up: "Up",
  through: "Through"
};

export class Pole extends JunctionShape {
  constructor(
    type?: PoleType,
    rise?: "none",
    id?: BlockShapeID
  );
  constructor(
    type: JunctionType,
    rise: Exclude<PoleRise, "none">,
    id?: BlockShapeID
  );
  constructor(
    type: JunctionType = "straight",
    rise: PoleRise = "none",
    id?: BlockShapeID
  ) {
    super(id ?? `pole${JUNCTION_ID_SUFFIX[type]}${kRiseIdSuffix[rise]}`, {
      min: kMin,
      max: kMax,
      arms: [...JUNCTION_ARMS[type], ...kRiseArms[rise]]
    });
  }
}
