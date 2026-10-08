// Import Third-party Dependencies
import type { Vec2 } from "@jolly-pixel/pixel-draw.renderer";

// CONSTANTS
const kRowStride = 65_536;

export type PixelArea = Iterable<Vec2> | "texture";

export class PixelKeySet {
  readonly named: ReadonlySet<string>;
  readonly texture: boolean;

  #pixels = new Set<number>();

  constructor(
    area: PixelArea | null,
    named: Iterable<string> = []
  ) {
    this.named = new Set(named);
    this.texture = area === "texture";
    if (area !== null && area !== "texture") {
      for (const { x, y } of area) {
        this.#pixels.add((y * kRowStride) + x);
      }
    }
  }

  get pixelCount(): number {
    return this.#pixels.size;
  }

  get holdsPixels(): boolean {
    return this.texture || this.#pixels.size > 0;
  }

  overlaps(
    other: PixelKeySet
  ): boolean {
    return this.#pixelsOverlap(other) ||
      intersects(this.named, other.named);
  }

  * positions(): IterableIterator<Vec2> {
    for (const packed of this.#pixels) {
      yield {
        x: packed % kRowStride,
        y: Math.floor(packed / kRowStride)
      };
    }
  }

  #pixelsOverlap(
    other: PixelKeySet
  ): boolean {
    if (!this.holdsPixels || !other.holdsPixels) {
      return false;
    }
    if (this.texture || other.texture) {
      return true;
    }

    return intersects(
      this.#pixels,
      other.#pixels
    );
  }
}

function intersects<T>(
  left: ReadonlySet<T>,
  right: ReadonlySet<T>
): boolean {
  const [small, large] = left.size <= right.size ?
    [left, right] :
    [right, left];
  for (const value of small) {
    if (large.has(value)) {
      return true;
    }
  }

  return false;
}
