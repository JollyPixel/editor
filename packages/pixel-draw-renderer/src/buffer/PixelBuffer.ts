// Import Internal Dependencies
import { resolveColor } from "../utils/colors.ts";
import { RectArea } from "../utils/RectArea.ts";
import { TextureBounds } from "./TextureBounds.ts";
import type { ColorGroup } from "./colorGroups.ts";
import type {
  ByteColorInput,
  RGBA8,
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
  defaultColor?: RGBA8 | ByteColorInput;
  /**
   * Maximum buffer dimension.
   * @default 2048
   */
  maxSize?: number;
}

// CONSTANTS
const kDefaultColor: RGBA8 = {
  r: 255,
  g: 255,
  b: 255,
  a: 255
};
const kTransparent: RGBA8 = {
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
  color: RGBA8
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

/**
 * Stores raw RGBA8 pixel data without DOM APIs.
 */
export class PixelBuffer implements DefaultPixelBuffer {
  #width: number;
  #height: number;
  #bounds: TextureBounds;
  #master: Uint8ClampedArray;
  #masterWidth: number;
  #masterHeight: number;
  #masterFill: RGBA8;
  #working: Uint8ClampedArray;

  constructor(
    options: PixelBufferOptions
  ) {
    const {
      size,
      defaultColor = kDefaultColor,
      maxSize = 2048
    } = options;

    this.#bounds = new TextureBounds(maxSize);
    this.#bounds.assert(size);

    this.#width = size.x;
    this.#height = size.y;
    const fillColor = resolveColor(defaultColor);
    this.#masterWidth = size.x;
    this.#masterHeight = size.y;
    this.#masterFill = { ...fillColor };
    this.#master = new Uint8ClampedArray(
      size.x * size.y * 4
    );
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

    const width = Math.max(
      size.x,
      this.#masterWidth
    );
    const height = Math.max(
      size.y,
      this.#masterHeight
    );
    const next = new Uint8ClampedArray(
      width * height * 4
    );

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

  #isPixelPositionInBounds(
    x: number,
    y: number
  ): boolean {
    return Number.isInteger(x) &&
      Number.isInteger(y) &&
      x >= 0 && x < this.#width &&
      y >= 0 && y < this.#height;
  }

  size(): Vec2 {
    return {
      x: this.#width,
      y: this.#height
    };
  }

  get maxSize(): number {
    return this.#bounds.maxSize;
  }

  acceptsSize(
    size: Vec2
  ): boolean {
    return this.#bounds.accepts(size);
  }

  assertSize(
    size: Vec2
  ): void {
    this.#bounds.assert(size);
  }

  resize(
    size: Vec2
  ): void {
    this.#bounds.assert(size);
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

  pixels(): Uint8ClampedArray {
    return this.#working;
  }

  replacePixels(
    pixels: Uint8ClampedArray,
    size: Vec2
  ): void {
    this.#bounds.assert(size);

    const expectedLength = size.x * size.y * 4;
    this.#width = size.x;
    this.#height = size.y;
    this.#working = new Uint8ClampedArray(expectedLength);
    this.#working.set(
      pixels.subarray(0, expectedLength)
    );
    this.#masterWidth = size.x;
    this.#masterHeight = size.y;
    this.#masterFill = { ...kTransparent };
    this.#master = Uint8ClampedArray.from(this.#working);
  }

  drawPixels(
    positions: Iterable<Vec2>,
    color: RGBA8
  ): void {
    const { r, g, b, a } = color;

    for (const { x, y } of positions) {
      if (!this.#isPixelPositionInBounds(x, y)) {
        continue;
      }

      const index = (y * this.#width + x) * 4;
      this.#working[index] = r;
      this.#working[index + 1] = g;
      this.#working[index + 2] = b;
      this.#working[index + 3] = a;
    }
  }

  drawColorGroups(
    groups: Iterable<ColorGroup>
  ): void {
    for (const group of groups) {
      this.drawPixels(group.positions, group.color);
    }
  }

  drawMaskedRegion(
    rect: SelectionRect,
    pixels: RGBA8[],
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
    if (!this.#isPixelPositionInBounds(x, y)) {
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

  samplePixels(
    positions: Vec2[]
  ): RGBA8[] {
    const colors: RGBA8[] = [];

    for (let i = 0; i < positions.length; i++) {
      const { x, y } = positions[i];
      if (!this.#isPixelPositionInBounds(x, y)) {
        colors[i] = {
          ...kTransparent
        };
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

  positionsOf(
    color: RGBA8,
    mask?: Uint8Array
  ): Vec2[] {
    const pixels = this.#working;
    const positions: Vec2[] = [];
    let byteIndex = 0;

    for (let y = 0; y < this.#height; y++) {
      for (let x = 0; x < this.#width; x++) {
        if (
          mask?.[byteIndex / 4] !== 0 &&
          pixels[byteIndex] === color.r &&
          pixels[byteIndex + 1] === color.g &&
          pixels[byteIndex + 2] === color.b &&
          pixels[byteIndex + 3] === color.a
        ) {
          positions.push({ x, y });
        }
        byteIndex += 4;
      }
    }

    return positions;
  }

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
