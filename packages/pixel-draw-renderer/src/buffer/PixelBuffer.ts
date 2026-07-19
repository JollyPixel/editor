// Import Internal Dependencies
import {
  toRGBA
} from "../utils/colors.ts";
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
   * Maximum master-buffer dimension.
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

/**
 * Stores raw RGBA pixel data without DOM APIs.
 */
export class PixelBuffer implements DefaultPixelBuffer {
  #width: number;
  #height: number;
  #maxSize: number;
  #master: Uint8ClampedArray;
  #working: Uint8ClampedArray;

  constructor(
    options: PixelBufferOptions
  ) {
    const {
      size,
      defaultColor = kDefaultColor,
      maxSize = 2048
    } = options;

    this.#maxSize = maxSize;
    this.#width = size.x;
    this.#height = size.y;
    this.#master = new Uint8ClampedArray(maxSize * maxSize * 4);
    this.#working = new Uint8ClampedArray(size.x * size.y * 4);
    this.#fill(toRGBA(defaultColor));
  }

  #fill(
    color: RGBA
  ): void {
    const { r, g, b, a } = color;

    for (let i = 0; i < this.#master.length; i += 4) {
      // Preserve a transparent origin pixel.
      const alpha = i === 0 ? 0 : a;
      this.#master[i] = r;
      this.#master[i + 1] = g;
      this.#master[i + 2] = b;
      this.#master[i + 3] = alpha;

      if (i < this.#working.length) {
        this.#working[i] = r;
        this.#working[i + 1] = g;
        this.#working[i + 2] = b;
        this.#working[i + 3] = alpha;
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
    const next = new Uint8ClampedArray(size.x * size.y * 4);

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
    this.#width = size.x;
    this.#height = size.y;
    this.#working = Uint8ClampedArray.from(pixels);
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
}
