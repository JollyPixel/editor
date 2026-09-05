// Import Internal Dependencies
import type {
  QuatLike,
  TransformLike,
  Vec2Like,
  Vec3Like,
  Vec4Like,
  Vector2Pair
} from "./types.ts";

// CONSTANTS
const kPairAxes: readonly string[] = ["x", "y", "z"];

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

/*
 * Exact, unlike the guards above: a three-axis value belongs to
 * `jolly-vector3`, not to a pair.
 */
export function vec2PairOf(
  value: unknown
): Vector2Pair | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.w === "number") {
    return null;
  }

  const axes = kPairAxes.filter(
    (axis) => typeof record[axis] === "number"
  );

  return axes.length === 2
    ? axes.join("") as Vector2Pair
    : null;
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
