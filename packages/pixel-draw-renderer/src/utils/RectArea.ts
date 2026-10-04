// Import Internal Dependencies
import type {
  SelectionRect,
  Vec2
} from "../types.ts";

export type ResizeCorner = "nw" | "ne" | "sw" | "se";
export type ResizeHandle = ResizeCorner | "n" | "s" | "e" | "w";

export interface RectRow {
  readonly x: number;
  readonly y: number;
  readonly length: number;
  readonly sourceIndex: number;
  readonly indexInBounds: number;
}

/**
 * Immutable row-major view over a rectangle of pixels.
 */
export class RectArea {
  readonly #rect: SelectionRect;

  static from(
    rect: SelectionRect
  ): RectArea {
    return new RectArea(rect);
  }

  static bounding(
    positions: Iterable<Vec2>,
    bounds?: Vec2
  ): RectArea | null {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const { x, y } of positions) {
      if (
        bounds && (
          x < 0 || x >= bounds.x ||
          y < 0 || y >= bounds.y
        )
      ) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }

    if (maxX < minX) {
      return null;
    }

    return new RectArea({
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    });
  }

  constructor(
    rect: SelectionRect
  ) {
    this.#rect = {
      ...rect
    };
  }

  get bounds(): SelectionRect {
    return {
      ...this.#rect
    };
  }

  get isEmpty(): boolean {
    return this.#rect.width <= 0 || this.#rect.height <= 0;
  }

  fitsWithin(
    bounds: Vec2
  ): boolean {
    return this.#rect.x >= 0 && this.#rect.y >= 0 &&
      this.#rect.x + this.#rect.width <= bounds.x &&
      this.#rect.y + this.#rect.height <= bounds.y;
  }

  intersection(
    bounds: Vec2
  ): SelectionRect | null {
    return RectArea.#intersect(this.#rect, {
      x: 0,
      y: 0,
      width: bounds.x,
      height: bounds.y
    });
  }

  resized(
    handle: ResizeHandle,
    delta: Vec2
  ): RectArea {
    const base = this.#rect;
    let left = base.x;
    let top = base.y;
    let right = base.x + base.width;
    let bottom = base.y + base.height;

    if (handle.includes("w")) {
      left = Math.min(left + delta.x, right - 1);
    }
    else if (handle.includes("e")) {
      right = Math.max(right + delta.x, left + 1);
    }
    if (handle.startsWith("n")) {
      top = Math.min(top + delta.y, bottom - 1);
    }
    else if (handle.startsWith("s")) {
      bottom = Math.max(bottom + delta.y, top + 1);
    }

    return new RectArea({
      x: left,
      y: top,
      width: right - left,
      height: bottom - top
    });
  }

  grown(
    amount: number
  ): RectArea {
    return new RectArea({
      x: this.#rect.x - amount,
      y: this.#rect.y - amount,
      width: this.#rect.width + (amount * 2),
      height: this.#rect.height + (amount * 2)
    });
  }

  union(
    rect: SelectionRect
  ): RectArea {
    const x = Math.min(this.#rect.x, rect.x);
    const y = Math.min(this.#rect.y, rect.y);

    return new RectArea({
      x,
      y,
      width: Math.max(
        this.#rect.x + this.#rect.width,
        rect.x + rect.width
      ) - x,
      height: Math.max(
        this.#rect.y + this.#rect.height,
        rect.y + rect.height
      ) - y
    });
  }

  clippedTo(
    rect: SelectionRect
  ): RectArea | null {
    const clipped = RectArea.#intersect(
      this.#rect,
      rect
    );

    return clipped === null
      ? null
      : new RectArea(clipped);
  }

  touchesEdgeOf(
    rect: SelectionRect
  ): boolean {
    return this.#rect.x === rect.x ||
      this.#rect.y === rect.y ||
      this.#rect.x + this.#rect.width === rect.x + rect.width ||
      this.#rect.y + this.#rect.height === rect.y + rect.height;
  }

  * rowsWithin(
    bounds: Vec2
  ): IterableIterator<RectRow> {
    const clipped = this.intersection(bounds);
    if (clipped === null) {
      return;
    }

    const localX = clipped.x - this.#rect.x;
    let sourceIndex = (
      (clipped.y - this.#rect.y) * this.#rect.width
    ) + localX;
    let indexInBounds = (clipped.y * bounds.x) + clipped.x;

    for (let row = 0; row < clipped.height; row++) {
      yield {
        x: clipped.x,
        y: clipped.y + row,
        length: clipped.width,
        sourceIndex,
        indexInBounds
      };
      sourceIndex += this.#rect.width;
      indexInBounds += bounds.x;
    }
  }

  static #intersect(
    a: SelectionRect,
    b: SelectionRect
  ): SelectionRect | null {
    const minX = Math.max(a.x, b.x);
    const minY = Math.max(a.y, b.y);
    const maxX = Math.min(a.x + a.width, b.x + b.width);
    const maxY = Math.min(a.y + a.height, b.y + b.height);
    if (
      maxX <= minX ||
      maxY <= minY
    ) {
      return null;
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }
}
