// Import Third-party Dependencies
import { roundTo } from "@jolly-pixel/utils";

// Import Internal Dependencies
import type { Vector3JSON } from "../../network/types.ts";

// CONSTANTS
const kDecimals = 4;

export function roundKeyValue(
  value: Vector3JSON
): Vector3JSON {
  return {
    x: roundTo(value.x, kDecimals),
    y: roundTo(value.y, kDecimals),
    z: roundTo(value.z, kDecimals)
  };
}
