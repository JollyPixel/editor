// Import Internal Dependencies
import {
  toRGBA
} from "../utils/colors.ts";
import { RectArea } from "../utils/RectArea.ts";
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
const kTransparent: RGBA = {
  r: 0,
  g: 0,
  b: 0,
  a: 0
};

function copyPixelRows(
  source: Uint8ClampedArray,
  sourceWidth: number,
  target: Uint8ClampedArray,
  targetWidth: number,
  height: number
): void {
  const byteWidth = Math.min(sourceWidth, targetWidth) * 4;
  if (sourceWidth === targetWidth) {
    target.set(source.subarray(0, byteWidth * height));

    return;
  }

  for (let y = 0; y < height; y++) {
    const sourceStart = y * sourceWidth * 4;
    const targetStart = y * targetWidth * 4;
    target.set(
      source.subarray(sourceStart, sourceStart + byteWidth),
      targetStart
    );
  }
}

function fillPixels(
  pixels: Uint8ClampedArray,
  color: RGBA
): void {
  const { r, g, b, a } = color;
  if (r === g && g === b && b === a) {
    pixels.fill(r);

    return;
  }

  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
    pixels[i + 3] = a;
  }
}

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
  #masterWidth: number;
  #masterHeight: number;
  #masterFill: RGBA;
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
    const fillColor = toRGBA(defaultColor);
    this.#masterWidth = size.x;
    this.#masterHeight = size.y;
    this.#masterFill = { ...fillColor };
    this.#master = new Uint8ClampedArray(size.x * size.y * 4);
    this.#working = new Uint8ClampedArray(
      size.x * size.y * 4
    );
    fillPixels(this.#master, fillColor);
    this.#working.set(this.#master);
  }

  #ensureMasterSize(
    size: Vec2
  ): void {
    if (
      size.x <= this.#masterWidth &&
      size.y <= this.#masterHeight
    ) {
      return;
    }

    const width = Math.max(size.x, this.#masterWidth);
    const height = Math.max(size.y, this.#masterHeight);
    const next = new Uint8ClampedArray(width * height * 4);
    fillPixels(next, this.#masterFill);
    copyPixelRows(
      this.#master,
      this.#masterWidth,
      next,
      width,
      this.#masterHeight
    );

    this.#master = next;
    this.#masterWidth = width;
    this.#masterHeight = height;
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
    this.#ensureMasterSize(size);

    const next = new Uint8ClampedArray(
      size.x * size.y * 4
    );
    copyPixelRows(
      this.#master,
      this.#masterWidth,
      next,
      size.x,
      size.y
    );

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
    this.#masterWidth = size.x;
    this.#masterHeight = size.y;
    this.#masterFill = { ...kTransparent };
    this.#master = Uint8ClampedArray.from(this.#working);
  }

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

  drawRegion(
    rect: SelectionRect,
    pixels: RGBA[]
  ): void {
    const size = this.size();
    const area = RectArea.from(rect);

    for (const row of area.rowsWithin(size)) {
      let sourceIndex = row.sourceIndex;
      let index = row.indexInBounds * 4;
      const sourceEnd = sourceIndex + row.length;

      while (sourceIndex < sourceEnd) {
        const { r, g, b, a } = pixels[sourceIndex];
        this.#working[index] = r;
        this.#working[index + 1] = g;
        this.#working[index + 2] = b;
        this.#working[index + 3] = a;
        sourceIndex++;
        index += 4;
      }
    }
  }

  drawMaskedRegion(
    rect: SelectionRect,
    pixels: RGBA[],
    mask: boolean[]
  ): void {
    const size = this.size();
    const area = RectArea.from(rect);

    for (const row of area.rowsWithin(size)) {
      let sourceIndex = row.sourceIndex;
      let index = row.indexInBounds * 4;
      const sourceEnd = sourceIndex + row.length;

      while (sourceIndex < sourceEnd) {
        if (!mask[sourceIndex]) {
          sourceIndex++;
          index += 4;
          continue;
        }

        const { r, g, b, a } = pixels[sourceIndex];
        this.#working[index] = r;
        this.#working[index + 1] = g;
        this.#working[index + 2] = b;
        this.#working[index + 3] = a;
        sourceIndex++;
        index += 4;
      }
    }
  }

  copyToMaster(): void {
    copyPixelRows(
      this.#working,
      this.#width,
      this.#master,
      this.#masterWidth,
      this.#height
    );
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
    const colors: RGBA[] = new Array(positions.length);

    for (let i = 0; i < positions.length; i++) {
      const { x, y } = positions[i];
      if (
        !Number.isInteger(x) ||
        !Number.isInteger(y) ||
        x < 0 || x >= this.#width ||
        y < 0 || y >= this.#height
      ) {
        colors[i] = { ...kTransparent };
        continue;
      }

      const index = (y * this.#width + x) * 4;
      colors[i] = {
        r: this.#working[index] ?? 0,
        g: this.#working[index + 1] ?? 0,
        b: this.#working[index + 2] ?? 0,
        a: this.#working[index + 3] ?? 0
      };
    }

    return colors;
  }

  /**
   * Whether any pixel in `rect` isn't fully opaque. Out-of-bounds cells
   * count as transparent, same as samplePixel(s).
   */
  hasTransparency(
    rect: SelectionRect
  ): boolean {
    const size = this.size();
    const area = RectArea.from(rect);
    if (area.isEmpty) {
      return false;
    }
    if (!area.fitsWithin(size)) {
      return true;
    }

    for (const row of area.rowsWithin(size)) {
      let alphaIndex = (row.indexInBounds * 4) + 3;
      const alphaEnd = alphaIndex + (row.length * 4);

      while (alphaIndex < alphaEnd) {
        if (this.#working[alphaIndex] < 255) {
          return true;
        }
        alphaIndex += 4;
      }
    }

    return false;
  }
}
