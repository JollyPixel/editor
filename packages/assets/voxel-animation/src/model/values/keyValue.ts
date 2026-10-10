// Import Internal Dependencies
import type { Vector3JSON } from "../../network/types.ts";

// CONSTANTS
const kScale = 10 ** 4;

export function roundKeyValue(
  value: Vector3JSON
): Vector3JSON {
  return {
    x: round(value.x),
    y: round(value.y),
    z: round(value.z)
  };
}

function round(
  value: number
): number {
  return (Math.round(value * kScale) / kScale) + 0;
}
