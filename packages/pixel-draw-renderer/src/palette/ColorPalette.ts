// Import Third-party Dependencies
import { isRGBA8 } from "@jolly-pixel/color";

// Import Internal Dependencies
import type { RGBA8 } from "../types.ts";
import { rgba8Equal } from "../utils/colors.ts";

// CONSTANTS
export const COLOR_PALETTE_MAX_SIZE = 256;
const kDefaultColors: RGBA8[] = [
  { r: 0, g: 0, b: 0, a: 255 },
  { r: 255, g: 255, b: 255, a: 255 },
  { r: 128, g: 128, b: 128, a: 255 },
  { r: 230, g: 57, b: 70, a: 255 },
  { r: 255, g: 140, b: 0, a: 255 },
  { r: 255, g: 221, b: 0, a: 255 },
  { r: 64, g: 180, b: 80, a: 255 },
  { r: 0, g: 180, b: 180, a: 255 },
  { r: 64, g: 112, b: 224, a: 255 },
  { r: 160, g: 80, b: 200, a: 255 }
];

export class ColorPalette {
  static create(): ColorPalette {
    return ColorPalette.from(kDefaultColors);
  }

  static from(
    colors: readonly RGBA8[]
  ): ColorPalette {
    const palette = ColorPalette.parse(colors);
    if (palette === null) {
      throw new TypeError(
        `A color palette requires 1 to ${COLOR_PALETTE_MAX_SIZE} RGBA8 colors`
      );
    }

    return palette;
  }

  static parse(
    value: unknown
  ): ColorPalette | null {
    if (
      !Array.isArray(value) ||
      value.length === 0 ||
      value.length > COLOR_PALETTE_MAX_SIZE ||
      !value.every(isRGBA8)
    ) {
      return null;
    }

    return new ColorPalette(value);
  }

  readonly #colors: RGBA8[];

  private constructor(
    colors: readonly RGBA8[]
  ) {
    this.#colors = colors.map(copyColor);
  }

  get size(): number {
    return this.#colors.length;
  }

  colorAt(
    index: number
  ): RGBA8 {
    this.#assertIndex(index, this.size - 1);

    return copyColor(this.#colors[index]);
  }

  withColor(
    index: number,
    color: RGBA8
  ): ColorPalette {
    return this.withColors(index, [color]);
  }

  withColors(
    start: number,
    colors: readonly RGBA8[]
  ): ColorPalette {
    this.#assertIndex(start, this.size - colors.length);
    assertColors(colors);

    const next = this.#colors.slice();
    next.splice(start, colors.length, ...colors);

    return this.#changed(next);
  }

  withInserted(
    index: number,
    colors: readonly RGBA8[]
  ): ColorPalette {
    this.#assertIndex(index, this.size);
    assertColors(colors);
    if (this.size + colors.length > COLOR_PALETTE_MAX_SIZE) {
      throw new RangeError(
        `A color palette holds at most ${COLOR_PALETTE_MAX_SIZE} colors`
      );
    }

    const next = this.#colors.slice();
    next.splice(index, 0, ...colors);

    return this.#changed(next);
  }

  withRemoved(
    start: number,
    count = 1
  ): ColorPalette {
    this.#assertIndex(start, this.size - count);
    if (count >= this.size) {
      throw new RangeError("A color palette keeps at least one color");
    }

    const next = this.#colors.slice();
    next.splice(start, count);

    return this.#changed(next);
  }

  withMoved(
    start: number,
    count: number,
    to: number
  ): ColorPalette {
    this.#assertIndex(start, this.size - count);
    this.#assertIndex(to, this.size - count);

    const next = this.#colors.slice();
    const moved = next.splice(start, count);
    next.splice(to, 0, ...moved);

    return this.#changed(next);
  }

  equals(
    other: ColorPalette
  ): boolean {
    return other.size === this.size && this.#colors.every(
      (color, index) => rgba8Equal(color, other.#colors[index])
    );
  }

  toJSON(): RGBA8[] {
    return this.#colors.map(copyColor);
  }

  #changed(
    colors: RGBA8[]
  ): ColorPalette {
    const next = new ColorPalette(colors);

    return next.equals(this) ? this : next;
  }

  #assertIndex(
    index: number,
    max: number
  ): void {
    if (!Number.isInteger(index) || index < 0 || index > max) {
      throw new RangeError(
        `Palette index must be an integer from 0 to ${Math.max(max, 0)}`
      );
    }
  }
}

function assertColors(
  colors: readonly RGBA8[]
): void {
  if (!colors.every(isRGBA8)) {
    throw new TypeError("Palette channels must be integer bytes");
  }
}

function copyColor(
  color: RGBA8
): RGBA8 {
  return {
    r: color.r,
    g: color.g,
    b: color.b,
    a: color.a
  };
}
