// Import Internal Dependencies
import type { BrushRingShape } from "../rendering/BrushRing.ts";
import { BRUSH_SIZE } from "../../../state/SculptSettings.ts";

// CONSTANTS
export const BRUSH_RING_PRESENCE_KEY = "terrain-brush";

export function decodeBrushRing(
  value: unknown
): BrushRingShape | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value !== "object") {
    return undefined;
  }

  const x = Reflect.get(value, "x");
  const z = Reflect.get(value, "z");
  const radius = Reflect.get(value, "radius");
  const innerRadius = Reflect.get(value, "innerRadius");
  if (
    !isFiniteNumber(x) ||
    !isFiniteNumber(z) ||
    !isFiniteNumber(radius) ||
    radius < BRUSH_SIZE.min ||
    radius > BRUSH_SIZE.max ||
    (innerRadius !== null && (!isFiniteNumber(innerRadius) || innerRadius < 0 || innerRadius > radius))
  ) {
    return undefined;
  }

  return {
    x,
    z,
    radius,
    innerRadius
  };
}

export function sameBrushRing(
  left: BrushRingShape | null,
  right: BrushRingShape | null
): boolean {
  if (left === null || right === null) {
    return left === right;
  }

  return left.x === right.x &&
    left.z === right.z &&
    left.radius === right.radius &&
    left.innerRadius === right.innerRadius;
}

function isFiniteNumber(
  value: unknown
): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
