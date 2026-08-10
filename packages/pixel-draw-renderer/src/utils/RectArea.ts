// Import Internal Dependencies
import { clipRectToBounds, pointInRect } from "./math.ts";
import type {
  SelectionRect,
  Vec2
} from "../types.ts";

export interface RectCell extends Vec2 {
  readonly localX: number;
  readonly localY: number;
  readonly sourceIndex: number;
}

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
export class RectArea implements Iterable<RectCell> {
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
    this.#rect = { ...rect };
  }

  get bounds(): SelectionRect {
    return { ...this.#rect };
  }

  get isEmpty(): boolean {
    return this.#rect.width <= 0 || this.#rect.height <= 0;
  }

  contains(
    position: Vec2
  ): boolean {
    return pointInRect(position, this.#rect);
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
    return clipRectToBounds(this.#rect, bounds);
  }

  * [Symbol.iterator](): IterableIterator<RectCell> {
    const { x, y, width, height } = this.#rect;
    let sourceIndex = 0;

    for (let localY = 0; localY < height; localY++) {
      for (let localX = 0; localX < width; localX++) {
        yield {
          x: x + localX,
          y: y + localY,
          localX,
          localY,
          sourceIndex
        };
        sourceIndex++;
      }
    }
  }

  /**
   * Iterates clipped row spans while preserving indices in the source area.
   */
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
}
