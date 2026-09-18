// Import Third-party Dependencies
import type { VoxelCoord } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  isBrushAnchor,
  isBrushAxis,
  isBrushPattern,
  type BrushFootprint
} from "./brushFootprint.ts";
import {
  isCellFace,
  type CellFace
} from "./cellFace.ts";

export interface BrushCursor extends BrushFootprint {
  face?: CellFace;
}

export function read(
  value: unknown
): BrushCursor | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const position = Reflect.get(value, "position");
  const size = Reflect.get(value, "size");
  if (
    typeof size !== "number" ||
    !Number.isFinite(size) ||
    size < 1 ||
    !isVoxelCoord(position)
  ) {
    return null;
  }

  const axis = Reflect.get(value, "axis");
  const pattern = Reflect.get(value, "pattern");
  const face = Reflect.get(value, "face");
  const anchor = Reflect.get(value, "anchor");

  return {
    position,
    size: Math.floor(size),
    axis: isBrushAxis(axis) ? axis : "xz",
    pattern: isBrushPattern(pattern) ? pattern : "square",
    ...isBrushAnchor(anchor) ? { anchor } : {},
    ...isCellFace(face) ? { face } : {}
  };
}

export function equals(
  a: BrushCursor | null,
  b: BrushCursor | null
): boolean {
  if (a === null || b === null) {
    return a === b;
  }

  return a.size === b.size &&
    a.axis === b.axis &&
    a.pattern === b.pattern &&
    a.face === b.face &&
    (a.anchor ?? "bottom") === (b.anchor ?? "bottom") &&
    a.position.x === b.position.x &&
    a.position.y === b.position.y &&
    a.position.z === b.position.z;
}

function isVoxelCoord(
  value: unknown
): value is VoxelCoord {
  return typeof value === "object" && value !== null &&
    typeof Reflect.get(value, "x") === "number" &&
    typeof Reflect.get(value, "y") === "number" &&
    typeof Reflect.get(value, "z") === "number";
}
