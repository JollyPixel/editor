// Import Internal Dependencies
import type { Axis } from "../common/axes.ts";

/**
 * `"xz"` excludes vertical interaction; `"xyz"` includes it.
 */
export type BoxAxisPolicy = "xz" | "xyz";

/**
 * `"none"` hides every resize arrow.
 */
export type BoxResizePolicy = BoxAxisPolicy | "none";

export type BoxDragMode = "move" | "resize";

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
  policy: BoxResizePolicy,
  axis: Axis
): boolean {
  if (policy === "none") {
    return false;
  }

  return axis === "y" ? policy === "xyz" : true;
}
