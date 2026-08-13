// Import Internal Dependencies
import type { SelectionRect } from "../types.ts";

export type UVFace =
  | "front"
  | "back"
  | "left"
  | "right"
  | "top"
  | "bottom";

export type UVRegionState =
  | "collapsed"
  | "uncollapsed";

export type UVTriangleCorner =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

/**
 * A triangular UV occupies three corners of its bounding rect.
 * Keeping the bounds separate lets all existing move and clamp paths stay rect-based.
 */
export interface UVTriangle {
  shape: "triangle";
  rect: SelectionRect;
  corner: UVTriangleCorner;
}

export type UVGeometry = SelectionRect | UVTriangle;

export const UV_FACES: readonly UVFace[] = [
  "front",
  "back",
  "left",
  "right",
  "top",
  "bottom"
];
