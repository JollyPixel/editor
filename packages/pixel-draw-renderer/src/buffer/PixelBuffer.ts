// Import Internal Dependencies
import {
  toRGBA
} from "../utils/colors.ts";
import { UVRegionCollection } from "../uv/UVRegionCollection.ts";
import type {
  ColorInput,
  RGBA,
  SelectionRect,
  Vec2
} from "../types.ts";
import type {
  DefaultPixelBuffer
} from "./types.ts";

export interface PixelBufferOptions {
  size: Vec2;
  /**
   * Default fill color.
   * @default { r: 255, g: 255, b: 255, a: 255 }
   */
  defaultColor?: RGBA | ColorInput;
  /**
   * Maximum buffer dimension.
   * @default 2048
   */
  maxSize?: number;
}

// CONSTANTS
const kDefaultColor: RGBA = {
  r: 255,
  g: 255,
  b: 255,
  a: 255
};

function assertMaxSize(
  maxSize: number
): void {
  if (!Number.isInteger(maxSize) || maxSize <= 0) {
    throw new RangeError("PixelBuffer maxSize must be a positive integer");
  }
}

function assertSize(
  size: Vec2,
  maxSize: number
): void {
  if (
    !Number.isInteger(size.x) ||
    !Number.isInteger(size.y) ||
    size.x <= 0 ||
    size.y <= 0 ||
    size.x > maxSize ||
    size.y > maxSize
  ) {
    throw new RangeError(
      `PixelBuffer dimensions must be positive integers no greater than ${maxSize}`
    );
  }
}

/**
 * Stores raw RGBA pixel data and UV regions without DOM APIs.
 */
export class PixelBuffer implements DefaultPixelBuffer {
  #width: number;
  #height: number;
  #maxSize: number;
  #master: Uint8ClampedArray;
  #working: Uint8ClampedArray;

  readonly uvRegions = new UVRegionCollection();

  constructor(
    options: PixelBufferOptions
  ) {
    const {
      size,
      defaultColor = kDefaultColor,
      maxSize = 2048
    } = options;

    assertMaxSize(maxSize);
    assertSize(size, maxSize);

    this.#maxSize = maxSize;
    this.#width = size.x;
    this.#height = size.y;
    this.#master = new Uint8ClampedArray(
      maxSize * maxSize * 4
    );
    this.#working = new Uint8ClampedArray(
      size.x * size.y * 4
    );
    this.#fill(toRGBA(defaultColor));
  }

  #fill(
    color: RGBA
  ): void {
    const { r, g, b, a } = color;

    for (let i = 0; i < this.#master.length; i += 4) {
      this.#master[i] = r;
      this.#master[i + 1] = g;
      this.#master[i + 2] = b;
      this.#master[i + 3] = a;

      if (i < this.#working.length) {
        this.#working[i] = r;
        this.#working[i + 1] = g;
        this.#working[i + 2] = b;
        this.#working[i + 3] = a;
      }
    }
  }

  size(): Vec2 {
    return {
      x: this.#width,
      y: this.#height
    };
  }

  resize(
    size: Vec2
  ): void {
    assertSize(size, this.#maxSize);

    const next = new Uint8ClampedArray(
      size.x * size.y * 4
    );

    for (let y = 0; y < size.y; y++) {
      for (let x = 0; x < size.x; x++) {
        const masterIndex = (y * this.#maxSize + x) * 4;
        const nextIndex = (y * size.x + x) * 4;

        next[nextIndex] = this.#master[masterIndex];
        next[nextIndex + 1] = this.#master[masterIndex + 1];
        next[nextIndex + 2] = this.#master[masterIndex + 2];
        next[nextIndex + 3] = this.#master[masterIndex + 3];
      }
    }

    this.#width = size.x;
    this.#height = size.y;
    this.#working = next;
  }

  /**
   * Returns the mutable working buffer.
   */
  pixels(): Uint8ClampedArray {
    return this.#working;
  }

  /**
   * Replaces pixels and resizes the buffer.
   */
  replacePixels(
    pixels: Uint8ClampedArray,
    size: Vec2
  ): void {
    assertSize(size, this.#maxSize);

    const expectedLength = size.x * size.y * 4;
    this.#width = size.x;
    this.#height = size.y;
    this.#working = new Uint8ClampedArray(expectedLength);
    this.#working.set(pixels.subarray(0, expectedLength));
    this.#master.fill(0);
    this.copyToMaster();
  }

  /**
   * Writes one color to each in-bounds position.
   */
  drawPixels(
    positions: Iterable<Vec2>,
    color: RGBA
  ): void {
    const { r, g, b, a } = color;

    for (const { x, y } of positions) {
      if (
        x < 0 || x >= this.#width ||
        y < 0 || y >= this.#height
      ) {
        continue;
      }

      const index = (y * this.#width + x) * 4;
      this.#working[index] = r;
      this.#working[index + 1] = g;
      this.#working[index + 2] = b;
      this.#working[index + 3] = a;
    }
  }

  /**
   * Writes row-major colors to in-bounds rectangle cells.
   */
  drawRegion(
    rect: SelectionRect,
    pixels: RGBA[]
  ): void {
    for (let ry = 0; ry < rect.height; ry++) {
      for (let rx = 0; rx < rect.width; rx++) {
        const x = rect.x + rx;
        const y = rect.y + ry;
        if (
          x < 0 || x >= this.#width ||
          y < 0 || y >= this.#height
        ) {
          continue;
        }

        const { r, g, b, a } = pixels[ry * rect.width + rx];
        const index = (y * this.#width + x) * 4;
        this.#working[index] = r;
        this.#working[index + 1] = g;
        this.#working[index + 2] = b;
        this.#working[index + 3] = a;
      }
    }
  }

  /**
   * Writes only rectangle cells with a true mask value.
   */
  drawMaskedRegion(
    rect: SelectionRect,
    pixels: RGBA[],
    mask: boolean[]
  ): void {
    for (let ry = 0; ry < rect.height; ry++) {
      for (let rx = 0; rx < rect.width; rx++) {
        const localIndex = (ry * rect.width) + rx;
        if (!mask[localIndex]) {
          continue;
        }

        const x = rect.x + rx;
        const y = rect.y + ry;
        if (
          x < 0 || x >= this.#width ||
          y < 0 || y >= this.#height
        ) {
          continue;
        }

        const { r, g, b, a } = pixels[localIndex];
        const index = (y * this.#width + x) * 4;
        this.#working[index] = r;
        this.#working[index + 1] = g;
        this.#working[index + 2] = b;
        this.#working[index + 3] = a;
      }
    }
  }

  copyToMaster(): void {
    for (let y = 0; y < this.#height; y++) {
      for (let x = 0; x < this.#width; x++) {
        const workingIndex = (y * this.#width + x) * 4;
        const masterIndex = (y * this.#maxSize + x) * 4;

        this.#master[masterIndex] = this.#working[workingIndex];
        this.#master[masterIndex + 1] = this.#working[workingIndex + 1];
        this.#master[masterIndex + 2] = this.#working[workingIndex + 2];
        this.#master[masterIndex + 3] = this.#working[workingIndex + 3];
      }
    }
  }

  samplePixel(
    x: number,
    y: number
  ): [number, number, number, number] {
    if (
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      x < 0 || x >= this.#width ||
      y < 0 || y >= this.#height
    ) {
      return [0, 0, 0, 0];
    }

    const index = (y * this.#width + x) * 4;

    return [
      this.#working[index] ?? 0,
      this.#working[index + 1] ?? 0,
      this.#working[index + 2] ?? 0,
      this.#working[index + 3] ?? 0
    ];
  }

  /**
   * Returns transparent pixels for out-of-bounds positions.
   */
  samplePixels(
    positions: Vec2[]
  ): RGBA[] {
    return positions.map(({ x, y }) => {
      if (
        x < 0 || x >= this.#width ||
        y < 0 || y >= this.#height
      ) {
        return { r: 0, g: 0, b: 0, a: 0 };
      }

      const [r, g, b, a] = this.samplePixel(x, y);

      return { r, g, b, a };
    });
  }

  /**
   * Whether any pixel in `rect` isn't fully opaque. Out-of-bounds cells
   * count as transparent, same as samplePixel(s).
   */
  hasTransparency(
    rect: SelectionRect
  ): boolean {
    for (let ry = 0; ry < rect.height; ry++) {
      for (let rx = 0; rx < rect.width; rx++) {
        const x = rect.x + rx;
        const y = rect.y + ry;
        if (
          x < 0 || x >= this.#width ||
          y < 0 || y >= this.#height
        ) {
          return true;
        }

        const [, , , a] = this.samplePixel(x, y);
        if (a < 255) {
          return true;
        }
      }
    }

    return false;
  }
}
