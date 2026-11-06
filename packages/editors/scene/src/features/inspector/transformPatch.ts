// Import Third-party Dependencies
import type {
  SceneTransformJSON,
  SceneTransformPatch
} from "@jolly-pixel/asset.scene/client";
import type { TransformChangeDetail } from "@jolly-pixel/ui";

// CONSTANTS
const kAxes = ["x", "y", "z"] as const;

export function transformPatch(
  detail: TransformChangeDetail,
  current: SceneTransformJSON
): SceneTransformPatch {
  const { field, value } = detail;
  const row = value[field];
  if (typeof row === "symbol") {
    return {};
  }

  const from = current[field];
  const [x, y, z] = kAxes.map((axis) => {
    const next = row[axis];

    return typeof next === "number" ? next : from[axis];
  });

  return { [field]: { x, y, z } };
}
