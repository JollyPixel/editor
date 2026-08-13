// Import Internal Dependencies
import { pointInRect } from "../utils/math.ts";
import type {
  SelectionRect,
  Vec2
} from "../types.ts";
import type { UVGeometry } from "./types.ts";

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
    this.#value = "shape" in value ?
      {
        shape: "triangle",
        corner: value.corner,
        rect: { ...value.rect }
      } :
      { ...value };
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
    switch (this.#value.corner) {
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
    return "shape" in this.#value ?
      {
        shape: "triangle",
        corner: this.#value.corner,
        rect: { ...this.#value.rect }
      } :
      { ...this.#value };
  }
}
