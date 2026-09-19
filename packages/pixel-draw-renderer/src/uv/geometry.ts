// Import Internal Dependencies
import type {
  RotationDirection,
  SelectionRect,
  Vec2
} from "../types.ts";
import { pointInRect } from "../utils/math.ts";
import type {
  UVCompoundPart,
  UVGeometry,
  UVNormalizedRect,
  UVQuarterTurn,
  UVTriangleCorner
} from "./types.ts";

// CONSTANTS
const kQuarterTurns: readonly UVQuarterTurn[] = [0, 1, 2, 3];
const kClockwiseCorners: readonly UVTriangleCorner[] = [
  "top-left",
  "top-right",
  "bottom-right",
  "bottom-left"
];

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
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height
  };
}

export function rotationOf(
  geometry: UVGeometry
): UVQuarterTurn {
  return geometry.rotation ?? 0;
}

export function withRotation(
  geometry: UVGeometry,
  rotation: number
): UVGeometry {
  const { rotation: _previous, ...rest } = geometry;
  const turns = quarterTurn(rotation);

  return turns === 0 ?
    rest :
    {
      ...rest,
      rotation: turns
    };
}

export function copyGeometry(
  geometry: UVGeometry
): UVGeometry {
  if (!("shape" in geometry)) {
    return withRotation(
      copyRect(geometry),
      rotationOf(geometry)
    );
  }

  const copied: UVGeometry = geometry.shape === "compound" ?
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

  return withRotation(copied, rotationOf(geometry));
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
    withRotation(copyRect(rect), rotationOf(geometry));
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

export function quarterTurn(
  turns: number
): UVQuarterTurn {
  return kQuarterTurns[((turns % 4) + 4) % 4];
}

export function quarterTurnsOf(
  direction: RotationDirection
): UVQuarterTurn {
  return direction === "cw" ? 1 : 3;
}

export function rotateCorner(
  corner: UVTriangleCorner,
  turns: number
): UVTriangleCorner {
  return kClockwiseCorners[
    (kClockwiseCorners.indexOf(corner) + quarterTurn(turns)) % 4
  ];
}

function rotateNormalizedRect(
  rect: UVNormalizedRect,
  turns: UVQuarterTurn
): UVNormalizedRect {
  let { x, y, width, height } = rect;
  for (let turn = 0; turn < turns; turn++) {
    [x, y, width, height] = [1 - (y + height), x, height, width];
  }

  return {
    x,
    y,
    width,
    height
  };
}

function rotatePart(
  part: UVCompoundPart,
  turns: UVQuarterTurn
): UVCompoundPart {
  if (!("shape" in part)) {
    return rotateNormalizedRect(part, turns);
  }

  return {
    shape: "triangle",
    corner: rotateCorner(part.corner, turns),
    rect: rotateNormalizedRect(part.rect, turns)
  };
}

export function rotateRect(
  rect: SelectionRect,
  turns: number
): SelectionRect {
  const swapped = quarterTurn(turns) % 2 === 1;

  return {
    x: rect.x,
    y: rect.y,
    width: swapped ? rect.height : rect.width,
    height: swapped ? rect.width : rect.height
  };
}

export function rotateGeometry(
  geometry: UVGeometry,
  turns: number
): UVGeometry {
  const quarter = quarterTurn(turns);
  if (quarter === 0) {
    return copyGeometry(geometry);
  }

  const rect = rotateRect(rectOf(geometry), quarter);
  const rotation = rotationOf(geometry) + quarter;
  if (!("shape" in geometry)) {
    return withRotation(rect, rotation);
  }

  const rotated: UVGeometry = geometry.shape === "compound" ?
    {
      shape: "compound",
      rect,
      parts: geometry.parts.map((part) => rotatePart(part, quarter))
    } :
    {
      shape: "triangle",
      corner: rotateCorner(geometry.corner, quarter),
      rect
    };

  return withRotation(rotated, rotation);
}

export function rotateUv(
  u: number,
  v: number,
  turns: number
): [number, number] {
  switch (quarterTurn(turns)) {
    case 1:
      return [v, 1 - u];
    case 2:
      return [1 - u, 1 - v];
    case 3:
      return [1 - v, u];
    default:
      return [u, v];
  }
}
