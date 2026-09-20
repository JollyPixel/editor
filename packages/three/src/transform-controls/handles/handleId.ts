// Import Internal Dependencies
import type { Axis } from "../../common/axes.ts";
import type { TransformHandle } from "../types.ts";

// CONSTANTS
export const PLANE_AXES: Readonly<Record<Axis, readonly [Axis, Axis]>> = {
  x: ["y", "z"],
  y: ["x", "z"],
  z: ["x", "y"]
};

export function handleKey(
  handle: TransformHandle
): string {
  switch (handle.kind) {
    case "axis":
      return `${handle.axis}-${handle.direction === 1 ? "positive" : "negative"}`;
    case "plane":
      return `plane-${PLANE_AXES[handle.normal].join("")}`;
    default:
      return handle.kind;
  }
}

export function sameHandle(
  left: TransformHandle,
  right: TransformHandle
): boolean {
  return handleKey(left) === handleKey(right);
}

export function handleAxes(
  handle: TransformHandle
): readonly Axis[] {
  switch (handle.kind) {
    case "axis":
      return [handle.axis];
    case "plane":
      return PLANE_AXES[handle.normal];
    default:
      return [];
  }
}
