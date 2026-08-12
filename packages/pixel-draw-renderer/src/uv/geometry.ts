// Import Internal Dependencies
import type {
  SelectionRect,
  Vec2
} from "../types.ts";
import { UVGeometryValue } from "./UVGeometryValue.ts";
import type { UVGeometry } from "./types.ts";

export function copyRect(
  rect: SelectionRect
): SelectionRect {
  return {
    ...rect
  };
}

export function copyGeometry(
  geometry: UVGeometry
): UVGeometry {
  return UVGeometryValue
    .from(geometry)
    .toJSON();
}

export function rectOf(
  geometry: UVGeometry
): SelectionRect {
  return UVGeometryValue
    .from(geometry)
    .bounds;
}

export function geometryAt(
  geometry: UVGeometry,
  rect: SelectionRect
): UVGeometry {
  return UVGeometryValue
    .from(geometry)
    .withBounds(rect)
    .toJSON();
}

export function pointInGeometry(
  pos: Vec2,
  geometry: UVGeometry
): boolean {
  return UVGeometryValue
    .from(geometry)
    .contains(pos);
}

export { UVGeometryValue } from "./UVGeometryValue.ts";
