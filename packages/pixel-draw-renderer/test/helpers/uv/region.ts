// Import Internal Dependencies
import { UVRegion } from "#src/uv/region/UVRegion.ts";
import type { SelectionRect } from "#src/types.ts";

// CONSTANTS
export const REGION_RECT: SelectionRect = {
  x: 1,
  y: 2,
  width: 3,
  height: 4
};

export function makeStacked(
  rect: SelectionRect = REGION_RECT
): UVRegion {
  return new UVRegion({
    state: "stacked",
    id: "r1",
    color: "#f00",
    rect
  });
}

export function makeFree(): UVRegion {
  return makeStacked().free();
}
