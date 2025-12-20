// Import Internal Dependencies
import { Cube } from "./Cube.ts";
import { Slope } from "./Slope.ts";
import { SlopeCorner } from "./SlopeCorner.ts";

export const VoxelShapes = {
  Cube,
  Slope,
  SlopeCorner
} as const;

export * from "./Shape.ts";
