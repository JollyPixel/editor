// Import Internal Dependencies
import type { RGBA8 } from "../types.ts";

// CONSTANTS
export const COLOR_PALETTE_SIZE = 10;
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
      throw new TypeError("A color palette requires ten RGBA8 colors");
    }

    return palette;
  }

  static parse(
    value: unknown
  ): ColorPalette | null {
    if (
      !Array.isArray(value) ||
      value.length !== COLOR_PALETTE_SIZE ||
      !value.every(isPaletteColor)
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

  colorAt(
    index: number
  ): RGBA8 {
    assertPaletteIndex(index);

    return copyColor(this.#colors[index]);
  }

  withColor(
    index: number,
    color: RGBA8
  ): ColorPalette {
    assertPaletteIndex(index);
    if (!isPaletteColor(color)) {
      throw new TypeError("Palette channels must be integer bytes");
    }
    const previous = this.#colors[index];
    if (
      previous.r === color.r &&
      previous.g === color.g &&
      previous.b === color.b &&
      previous.a === color.a
    ) {
      return this;
    }

    const colors = this.toJSON();
    colors[index] = copyColor(color);

    return new ColorPalette(colors);
  }

  toJSON(): RGBA8[] {
    return this.#colors.map(copyColor);
  }
}

function assertPaletteIndex(
  index: number
): void {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= COLOR_PALETTE_SIZE
  ) {
    throw new RangeError("Palette slot index must be an integer from 0 to 9");
  }
}

function isPaletteColor(
  value: unknown
): value is RGBA8 {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  return ["r", "g", "b", "a"].every((key) => {
    const channel = Reflect.get(value, key);

    return Number.isInteger(channel) && channel >= 0 && channel <= 255;
  });
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
