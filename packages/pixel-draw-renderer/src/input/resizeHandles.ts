// Import Internal Dependencies
import type {
  SelectionRect,
  Vec2
} from "../types.ts";

import type {
  ResizeCorner,
  ResizeHandle
} from "../utils/RectArea.ts";

// CONSTANTS
const kReach = 6;
export const RESIZE_CURSORS: Readonly<Record<ResizeHandle, string>> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize"
};

export function resizeCornerAt(
  rect: SelectionRect,
  point: Vec2
): ResizeCorner | null {
  const x = cornerSide(point.x, rect.x, rect.width);
  const y = cornerSide(point.y, rect.y, rect.height);
  if (x === null || y === null) {
    return null;
  }

  if (y) {
    return x ? "se" : "sw";
  }

  return x ? "ne" : "nw";
}

function cornerSide(
  value: number,
  start: number,
  length: number
): boolean | null {
  const inner = Math.min(kReach, length / 3);
  const toStart = value - start;
  const toEnd = start + length - value;
  if (toStart >= -kReach && toStart <= inner && toStart <= toEnd) {
    return false;
  }
  if (toEnd >= -kReach && toEnd <= inner) {
    return true;
  }

  return null;
}
