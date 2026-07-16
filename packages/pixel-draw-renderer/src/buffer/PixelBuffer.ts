// Import Internal Dependencies
import { toRGBA } from "../colors.ts";
import type { ColorInput, DefaultPixelBuffer, RGBA, SelectionRect, Vec2 } from "../types.ts";

export interface PixelBufferOptions {
  size: Vec2;
  /**
   * Default fill color for newly created pixels. Accepts an RGBA object, a
   * CSS color string (hex, rgb(), hsl(), named color, ...) or a colorjs.io
   * `Color` instance.
   * @default { r: 255, g: 255, b: 255, a: 255 }
   */
  defaultColor?: RGBA | ColorInput;
  /**
   * Size of the backing master buffer. The working buffer can be resized up
   * to this limit without losing data previously committed via copyToMaster.
   * @default 2048
   */
  maxSize?: number;
}

const kDefaultColor: RGBA = { r: 255, g: 255, b: 255, a: 255 };

/**
 * PixelBuffer holds raw RGBA pixel data with no DOM dependency, so it can run
 * in a headless environment (server, tests) as well as behind a Canvas2D
 * adapter (CanvasBuffer) in the browser.
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

    const { r, g, b, a } = toRGBA(defaultColor);

    this.#maxSize = maxSize;
    this.#width = size.x;
    this.#height = size.y;
    this.#master = new Uint8ClampedArray(maxSize * maxSize * 4);
    this.#working = new Uint8ClampedArray(size.x * size.y * 4);
    this.#fill({ r, g, b, a });
  }

  #fill(
    color: RGBA
  ): void {
    const { r, g, b, a } = color;

    for (let i = 0; i < this.#master.length; i += 4) {
      // Pixel (0,0) is always initialized fully transparent, regardless of
      // defaultColor — preserved from the original CanvasBuffer behavior.
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

  getSize(): Vec2 {
    return { x: this.#width, y: this.#height };
  }

  setSize(
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
   * Returns the live working buffer (not a copy).
   */
  getPixels(): Uint8ClampedArray {
    return this.#working;
  }

  /**
   * Replaces the pixel data wholesale, resizing the buffer to match.
   */
  setPixels(
    pixels: Uint8ClampedArray,
    size: Vec2
  ): void {
    this.#width = size.x;
    this.#height = size.y;
    this.#working = Uint8ClampedArray.from(pixels);
  }

  /**
   * Stamps a single color across a list of positions; out-of-bounds
   * positions are skipped.
   */
  drawPixels(
    positions: Vec2[],
    color: RGBA
  ): void {
    const { r, g, b, a } = color;

    for (const { x, y } of positions) {
      // Mirrors Canvas2D's implicit clipping of out-of-bounds putImageData calls.
      if (x < 0 || x >= this.#width || y < 0 || y >= this.#height) {
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
   * Writes a rectangular block of per-pixel colors (row-major), unlike
   * drawPixels which stamps one color across a list of positions.
   * Out-of-bounds positions are skipped, same as drawPixels.
   */
  drawRegion(
    rect: SelectionRect,
    pixels: RGBA[]
  ): void {
    for (let ry = 0; ry < rect.height; ry++) {
      for (let rx = 0; rx < rect.width; rx++) {
        const x = rect.x + rx;
        const y = rect.y + ry;
        if (x < 0 || x >= this.#width || y < 0 || y >= this.#height) {
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
}
