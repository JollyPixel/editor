// Import Internal Dependencies
import type { SelectionRect } from "../types.ts";

/**
 * Consumer-defined texture slot identifier.
 */
export type UVSlot = string;

export type UVRegionState =
  | "collapsed"
  | "uncollapsed";

export type UVTriangleCorner =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface UVTriangle {
  shape: "triangle";
  rect: SelectionRect;
  corner: UVTriangleCorner;
}

export type UVCompoundPart =
  | UVNormalizedRect
  | {
    shape: "triangle";
    rect: UVNormalizedRect;
    corner: UVTriangleCorner;
  };

/**
 * Rectangle in normalized local geometry space.
 */
export interface UVNormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UVCompound {
  shape: "compound";
  rect: SelectionRect;
  parts: readonly UVCompoundPart[];
}

export type UVGeometry =
  | SelectionRect
  | UVTriangle
  | UVCompound;

export const UV_FACES: readonly UVSlot[] = [
  "front",
  "back",
  "left",
  "right",
  "top",
  "bottom"
];
