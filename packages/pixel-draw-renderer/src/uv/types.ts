// Import Internal Dependencies
import type { SelectionRect } from "../types.ts";

/**
 * Consumer-defined texture slot identifier.
 */
export type UVSlot = string;

/**
 * Clockwise quarter turns in texture space, where y points down.
 */
export type UVQuarterTurn = 0 | 1 | 2 | 3;

export type UVRegionState =
  | "stacked"
  | "unfolded"
  | "free";

export type UVTriangleCorner =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface UVRect extends SelectionRect {
  rotation?: UVQuarterTurn;
}

export interface UVTriangle {
  shape: "triangle";
  rect: SelectionRect;
  corner: UVTriangleCorner;
  rotation?: UVQuarterTurn;
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
  parts: UVCompoundPart[];
  rotation?: UVQuarterTurn;
}

export type UVGeometry =
  | UVRect
  | UVTriangle
  | UVCompound;

export const DEFAULT_UV_SLOTS: readonly UVSlot[] = [
  "front",
  "back",
  "left",
  "right",
  "top",
  "bottom"
];
