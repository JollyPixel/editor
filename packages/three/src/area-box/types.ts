export type AreaAxis = "x" | "y" | "z";

/**
 * `+1` targets the max face of an axis, `-1` its min face.
 */
export type AreaHandleSign = 1 | -1;

/**
 * `"xz"` excludes vertical interaction; `"xyz"` includes it.
 */
export type AreaAxisPolicy = "xz" | "xyz";

export type AreaDragMode = "move" | "resize";

export type AreaBoxState = "idle" | "hovered" | "active";

export interface AxisRange {
  min: number;
  max: number;
}

export interface AxisExtent {
  min: number;
  size: number;
}

export function axisPolicyIncludes(
  policy: AreaAxisPolicy,
  axis: AreaAxis
): boolean {
  return axis === "y" ? policy === "xyz" : true;
}
