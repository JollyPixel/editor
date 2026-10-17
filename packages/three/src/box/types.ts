// Import Internal Dependencies
import type { Axis } from "../common/axes.ts";

export type BoxAxisPolicy = "xz" | "xyz";

export type BoxResizePolicy = BoxAxisPolicy | "none";

export type BoxRotatePolicy = "y" | "none";

export type BoxFlipPolicy = BoxAxisPolicy | "none";

export type BoxDragMode = "move" | "resize" | "rotate" | "flip";

export type BoxState = "idle" | "hovered" | "active";

export interface AxisRange {
  min: number;
  max: number;
}

export interface AxisExtent {
  min: number;
  size: number;
}

export function axisPolicyIncludes(
  policy: BoxResizePolicy | BoxFlipPolicy,
  axis: Axis
): boolean {
  if (policy === "none") {
    return false;
  }

  return axis === "y" ? policy === "xyz" : true;
}
