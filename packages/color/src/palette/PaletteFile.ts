// Import Internal Dependencies
import { isRGBA8 } from "../convert/bytes.ts";
import type { RGBA8 } from "../types.ts";

export class PaletteFile {
  readonly colors: readonly RGBA8[];
  readonly name: string | null;

  constructor(
    colors: readonly RGBA8[],
    name: string | null = null
  ) {
    if (colors.length === 0) {
      throw new RangeError("A palette file needs at least one color");
    }
    if (!colors.every(isRGBA8)) {
      throw new TypeError("Palette channels must be integer bytes");
    }

    this.colors = Object.freeze(colors.map((color) => {
      return {
        r: color.r,
        g: color.g,
        b: color.b,
        a: color.a
      };
    }));
    this.name = name;
  }
}
