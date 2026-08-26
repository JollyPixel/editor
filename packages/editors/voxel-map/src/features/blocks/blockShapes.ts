// Import Third-party Dependencies
import type { BlockShapeID } from "@jolly-pixel/voxel.renderer";
import type { JollyOption } from "@jolly-pixel/ui";

export const BLOCK_SHAPE_IDS: BlockShapeID[] = [
  "cube",
  "slabBottom",
  "slabTop",
  "poleY",
  "pole",
  "ramp",
  "rampCornerInner",
  "rampCornerOuter",
  "stair",
  "stairCornerInner",
  "stairCornerOuter"
];

export const BLOCK_SHAPE_OPTIONS: JollyOption<BlockShapeID>[] =
  BLOCK_SHAPE_IDS.map((id) => {
    return { label: id, value: id };
  });
