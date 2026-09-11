// Import Internal Dependencies
import { clampRectPosition } from "../utils/math.ts";
import type {
  SelectionRect,
  Vec2
} from "../types.ts";

export interface SelectionPlacementOptions {
  cursor: Vec2 | null;
  viewCenter: Vec2;
  bounds: Vec2;
}

export function placeSelection(
  size: {
    width: number;
    height: number;
  },
  options: SelectionPlacementOptions
): SelectionRect {
  const anchor = options.cursor ?? options.viewCenter;

  return clampRectPosition(
    {
      x: anchor.x - Math.floor(size.width / 2),
      y: anchor.y - Math.floor(size.height / 2),
      width: size.width,
      height: size.height
    },
    options.bounds
  );
}
