// Import Internal Dependencies
import type {
  SelectionRect,
  Vec2
} from "../types.ts";
import { UVGeometryValue } from "./UVGeometryValue.ts";
import type {
  UVGeometry,
  UVTriangleCorner
} from "./types.ts";

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

export function triangleCornerOf(
  geometry: UVGeometry
): UVTriangleCorner | null {
  return "shape" in geometry && geometry.shape === "triangle" ?
    geometry.corner :
    null;
}

export function partsOf(
  geometry: UVGeometry
): UVGeometry[] {
  if (!("shape" in geometry) || geometry.shape !== "compound") {
    return [copyGeometry(geometry)];
  }

  const { rect, parts } = geometry;

  return parts.map((part) => {
    const local = "shape" in part ? part.rect : part;
    const scaled: SelectionRect = {
      x: rect.x + (local.x * rect.width),
      y: rect.y + (local.y * rect.height),
      width: local.width * rect.width,
      height: local.height * rect.height
    };

    return "shape" in part ?
      {
        shape: "triangle" as const,
        corner: part.corner,
        rect: scaled
      } :
      scaled;
  });
}
