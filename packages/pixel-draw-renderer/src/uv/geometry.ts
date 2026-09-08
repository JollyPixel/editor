// Import Internal Dependencies
import type {
  SelectionRect,
  Vec2
} from "../types.ts";
import { pointInRect } from "../utils/math.ts";
import type {
  UVCompoundPart,
  UVGeometry,
  UVTriangleCorner
} from "./types.ts";

function copyPart(
  part: UVCompoundPart
): UVCompoundPart {
  return "shape" in part ?
    {
      shape: "triangle",
      corner: part.corner,
      rect: { ...part.rect }
    } :
    { ...part };
}

function cornerContains(
  corner: UVTriangleCorner,
  x: number,
  y: number
): boolean {
  switch (corner) {
    case "top-right":
      return x >= y;
    case "bottom-left":
      return x <= y;
    case "top-left":
      return x + y <= 1;
    default:
      return x + y >= 1;
  }
}

function partContains(
  part: UVCompoundPart,
  x: number,
  y: number
): boolean {
  const rect = "shape" in part ? part.rect : part;
  if (
    x < rect.x ||
    y < rect.y ||
    x > rect.x + rect.width ||
    y > rect.y + rect.height
  ) {
    return false;
  }

  return !("shape" in part) || cornerContains(
    part.corner,
    (x - rect.x) / rect.width,
    (y - rect.y) / rect.height
  );
}

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
  if (!("shape" in geometry)) {
    return copyRect(geometry);
  }

  return geometry.shape === "compound" ?
    {
      shape: "compound",
      rect: copyRect(geometry.rect),
      parts: geometry.parts.map(copyPart)
    } :
    {
      shape: "triangle",
      corner: geometry.corner,
      rect: copyRect(geometry.rect)
    };
}

export function rectOf(
  geometry: UVGeometry
): SelectionRect {
  return copyRect(
    "shape" in geometry ? geometry.rect : geometry
  );
}

export function geometryAt(
  geometry: UVGeometry,
  rect: SelectionRect
): UVGeometry {
  const copied = copyGeometry(geometry);

  return "shape" in copied ?
    {
      ...copied,
      rect: copyRect(rect)
    } :
    copyRect(rect);
}

export function geometryKey(
  geometry: UVGeometry
): string {
  const { x, y, width, height } = rectOf(geometry);

  if (!("shape" in geometry)) {
    return `${x},${y},${width},${height}`;
  }

  const shape = geometry.shape === "compound" ?
    `compound:${JSON.stringify(geometry.parts)}` :
    `triangle:${geometry.corner}`;

  return `${shape}:${x},${y},${width},${height}`;
}

export function pointInGeometry(
  pos: Vec2,
  geometry: UVGeometry
): boolean {
  const rect = rectOf(geometry);
  if (!pointInRect(pos, rect)) {
    return false;
  }
  if (!("shape" in geometry)) {
    return true;
  }

  const x = (pos.x - rect.x) / rect.width;
  const y = (pos.y - rect.y) / rect.height;
  if (geometry.shape === "triangle") {
    return cornerContains(geometry.corner, x, y);
  }

  return geometry.parts.some(
    (part) => partContains(part, x, y)
  );
}

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
