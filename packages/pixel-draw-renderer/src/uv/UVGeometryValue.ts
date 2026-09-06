// Import Internal Dependencies
import { pointInRect } from "../utils/math.ts";
import type {
  SelectionRect,
  Vec2
} from "../types.ts";
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

function copyValue(
  value: UVGeometry
): UVGeometry {
  if (!("shape" in value)) {
    return { ...value };
  }

  return value.shape === "compound" ?
    {
      shape: "compound",
      rect: { ...value.rect },
      parts: value.parts.map(copyPart)
    } :
    {
      shape: "triangle",
      corner: value.corner,
      rect: { ...value.rect }
    };
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

  if (!("shape" in part)) {
    return true;
  }

  return cornerContains(
    part.corner,
    (x - rect.x) / rect.width,
    (y - rect.y) / rect.height
  );
}

export class UVGeometryValue {
  readonly #value: UVGeometry;

  static from(
    value: UVGeometry
  ): UVGeometryValue {
    return new UVGeometryValue(value);
  }

  constructor(
    value: UVGeometry
  ) {
    this.#value = copyValue(value);
  }

  get bounds(): SelectionRect {
    return "shape" in this.#value ?
      { ...this.#value.rect } :
      { ...this.#value };
  }

  contains(pos: Vec2): boolean {
    const rect = this.bounds;
    if (!pointInRect(pos, rect)) {
      return false;
    }

    if (!("shape" in this.#value)) {
      return true;
    }

    const x = (pos.x - rect.x) / rect.width;
    const y = (pos.y - rect.y) / rect.height;
    if (this.#value.shape === "triangle") {
      return cornerContains(this.#value.corner, x, y);
    }

    return this.#value.parts.some(
      (part) => partContains(part, x, y)
    );
  }

  withBounds(
    rect: SelectionRect
  ): UVGeometryValue {
    return new UVGeometryValue(
      "shape" in this.#value ?
        { ...this.#value, rect } :
        rect
    );
  }

  toJSON(): UVGeometry {
    return copyValue(this.#value);
  }
}
