// Import Internal Dependencies
import { FACE } from "../../../geometry/faceDirection.ts";
import type { BlockShapeID } from "../BlockShape.ts";
import {
  JunctionShape,
  type Junction
} from "./JunctionShape.ts";

export type SlabType =
  | "bottom"
  | "top"
  | "beam"
  | "corner"
  | "notch";

interface SlabLayout {
  id: BlockShapeID;
  junction: Junction;
}

// CONSTANTS
const kSlabs: Record<SlabType, SlabLayout> = {
  bottom: {
    id: "slabBottom",
    junction: {
      min: [0, 0, 0],
      max: [1, 0.5, 1]
    }
  },
  top: {
    id: "slabTop",
    junction: {
      min: [0, 0.5, 0],
      max: [1, 1, 1]
    }
  },
  beam: {
    id: "slabBeam",
    junction: {
      min: [0, 0, 0],
      max: [1, 0.5, 0.5]
    }
  },
  corner: {
    id: "slabCorner",
    junction: {
      min: [0, 0, 0],
      max: [0.5, 0.5, 0.5]
    }
  },
  notch: {
    id: "slabNotch",
    junction: {
      min: [0.5, 0, 0.5],
      max: [1, 0.5, 1],
      arms: [FACE.NegX, FACE.NegZ]
    }
  }
};

export class Slab extends JunctionShape {
  constructor(
    type: SlabType = "bottom",
    id?: BlockShapeID
  ) {
    const layout = kSlabs[type];

    super(id ?? layout.id, layout.junction);
  }
}
