// Import Internal Dependencies
import { Cube } from "./Cube.js";
import { Slope } from "./Slope.js";
import { SlopeCorner } from "./SlopeCorner.js";

export const VoxelShapes = {
  Cube,
  Slope,
  SlopeCorner
} as const;

export * from "./Shape.js";
