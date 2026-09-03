// Import Internal Dependencies
import type {
  QuatLike,
  TransformLike,
  Vec2Like,
  Vec3Like,
  Vec4Like
} from "./types.ts";

/*
 * Each guard asks only for the axes it names, so a four-axis value satisfies
 * the two- and three-axis guards too. Callers that need one answer test from
 * the widest shape down.
 */

export function isVec2Like(
  value: unknown
): value is Vec2Like {
  return hasAxes(value, ["x", "y"]);
}

export function isVec3Like(
  value: unknown
): value is Vec3Like {
  return hasAxes(value, ["x", "y", "z"]);
}

export function isVec4Like(
  value: unknown
): value is Vec4Like {
  return hasAxes(value, ["x", "y", "z", "w"]);
}

export function isQuatLike(
  value: unknown
): value is QuatLike {
  return hasAxes(value, ["x", "y", "z", "w"]);
}

export function isTransformLike(
  value: unknown
): value is TransformLike {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;

  return isVec3Like(record.position) &&
    isQuatLike(record.rotation) &&
    isVec3Like(record.scale);
}

function hasAxes(
  value: unknown,
  axes: readonly string[]
): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;

  return axes.every((axis) => typeof record[axis] === "number");
}
