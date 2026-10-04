// Import Internal Dependencies
import { UVRegion } from "#src/uv/region/UVRegion.ts";
import type { SelectionRect } from "#src/types.ts";

export function cell(
  column: number,
  row: number
): SelectionRect {
  return {
    x: 10 + column * 4,
    y: 10 + row * 4,
    width: 4,
    height: 4
  };
}

export function unfolded(): UVRegion {
  return new UVRegion({
    id: "r1",
    color: "#f00",
    state: "unfolded",
    faces: {
      front: cell(0, 0),
      back: cell(1, 0),
      left: cell(2, 0),
      right: cell(0, 1),
      top: cell(1, 1),
      bottom: cell(2, 1)
    }
  });
}
