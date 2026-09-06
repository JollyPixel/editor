// Import Internal Dependencies
import type { SelectionRect } from "../types.ts";

export type UVFace = string;

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
  | SelectionRect
  | {
    shape: "triangle";
    rect: SelectionRect;
    corner: UVTriangleCorner;
  };

export interface UVCompound {
  shape: "compound";
  rect: SelectionRect;
  parts: readonly UVCompoundPart[];
}

export type UVGeometry =
  | SelectionRect
  | UVTriangle
  | UVCompound;

export const UV_FACES: readonly UVFace[] = [
  "front",
  "back",
  "left",
  "right",
  "top",
  "bottom"
];
