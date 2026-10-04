// Import Internal Dependencies
import { filledArray } from "../utils/array.ts";
import { pointInRect } from "../utils/math.ts";
import type { DefaultPixelBuffer } from "../buffer/types.ts";
import type {
  RGBA8,
  RotationDirection,
  SelectionRect,
  Vec2
} from "../types.ts";

export interface SelectionContentData {
  rect: SelectionRect;
  pixels: RGBA8[];
  mask: boolean[];
}

export class SelectionContent {
  readonly rect: Readonly<SelectionRect>;
  readonly pixels: readonly RGBA8[];
  readonly mask: readonly boolean[];

  static capture(
    buffer: DefaultPixelBuffer,
    rect: SelectionRect,
    mask: boolean[] = filledArray(
      rect.width * rect.height,
      true
    )
  ): SelectionContent {
    const positions: Vec2[] = [];
    for (let y = rect.y; y < rect.y + rect.height; y++) {
      for (let x = rect.x; x < rect.x + rect.width; x++) {
        positions.push({ x, y });
      }
    }

    return new SelectionContent({
      rect,
      pixels: buffer.samplePixels(positions),
      mask
    });
  }

  static parse(
    data: SelectionContentData
  ): SelectionContent | null {
    if (!SelectionContent.#isValid(data)) {
      return null;
    }

    return new SelectionContent({
      rect: { ...data.rect },
      pixels: data.pixels.map((pixel) => {
        return { ...pixel };
      }),
      mask: [...data.mask]
    });
  }

  constructor(
    data: SelectionContentData
  ) {
    if (!SelectionContent.#isValid(data)) {
      throw new RangeError(
        "Selection content must match its rect and select at least one pixel"
      );
    }

    this.rect = Object.freeze({ ...data.rect });
    this.pixels = Object.freeze(data.pixels);
    this.mask = Object.freeze(data.mask);
  }

  hitTest(
    position: Vec2
  ): boolean {
    return pointInRect(
      position,
      this.rect
    ) && this.mask[this.#indexOf(position)];
  }

  colorAt(
    position: Vec2
  ): RGBA8 {
    return this.pixels[this.#indexOf(position)];
  }

  * positions(): IterableIterator<Vec2> {
    const { x, y, width, height } = this.rect;

    for (let row = 0; row < height; row++) {
      for (let column = 0; column < width; column++) {
        if (this.mask[(row * width) + column]) {
          yield {
            x: x + column,
            y: y + row
          };
        }
      }
    }
  }

  movedTo(
    position: Vec2
  ): SelectionContent {
    return new SelectionContent({
      rect: {
        ...this.rect,
        x: position.x,
        y: position.y
      },
      pixels: [...this.pixels],
      mask: [...this.mask]
    });
  }

  erased(
    color: RGBA8
  ): SelectionContent {
    return new SelectionContent({
      rect: this.rect,
      pixels: this.pixels.map(
        (pixel, index) => (this.mask[index] ? color : pixel)
      ),
      mask: [...this.mask]
    });
  }

  rotated(
    direction: RotationDirection
  ): SelectionContent {
    const { width, height } = this.rect;
    function indexOf(
      x: number,
      y: number
    ): number {
      const sourceX = direction === "cw" ? y : width - 1 - y;
      const sourceY = direction === "cw" ? height - 1 - x : x;

      return (sourceY * width) + sourceX;
    }

    return new SelectionContent({
      rect: {
        x: Math.round(this.rect.x + (width / 2) - (height / 2)),
        y: Math.round(this.rect.y + (height / 2) - (width / 2)),
        width: height,
        height: width
      },
      pixels: SelectionContent.#remap(
        this.pixels,
        height,
        width,
        indexOf
      ),
      mask: SelectionContent.#remap(
        this.mask,
        height,
        width,
        indexOf
      )
    });
  }

  flippedHorizontal(): SelectionContent {
    const { width } = this.rect;

    return this.#remapped(
      (x, y) => (y * width) + (width - 1 - x)
    );
  }

  flippedVertical(): SelectionContent {
    const { width, height } = this.rect;

    return this.#remapped(
      (x, y) => ((height - 1 - y) * width) + x
    );
  }

  toJSON(): SelectionContentData {
    return {
      rect: { ...this.rect },
      pixels: this.pixels.map((pixel) => {
        return { ...pixel };
      }),
      mask: [...this.mask]
    };
  }

  #indexOf(
    position: Vec2
  ): number {
    const { x, y } = position;
    const { x: rectX, y: rectY, width } = this.rect;

    return ((y - rectY) * width) + (x - rectX);
  }

  #remapped(
    indexOf: (x: number, y: number) => number
  ): SelectionContent {
    const { width, height } = this.rect;

    return new SelectionContent({
      rect: this.rect,
      pixels: SelectionContent.#remap(
        this.pixels,
        width,
        height,
        indexOf
      ),
      mask: SelectionContent.#remap(
        this.mask,
        width,
        height,
        indexOf
      )
    });
  }

  static #isValid(
    data: SelectionContentData
  ): boolean {
    const area = data.rect.width * data.rect.height;

    return data.pixels.length === area &&
      data.mask.length === area &&
      data.mask.some(Boolean);
  }

  static #remap<T>(
    grid: readonly T[],
    width: number,
    height: number,
    indexOf: (x: number, y: number) => number
  ): T[] {
    const result: T[] = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        result.push(grid[indexOf(x, y)]);
      }
    }

    return result;
  }
}
