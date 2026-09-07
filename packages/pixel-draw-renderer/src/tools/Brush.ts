// Import Third-party Dependencies
import {
  formatHex,
  formatRgb,
  formatRgba,
  toRGBA8,
  type RGBA
} from "@jolly-pixel/color";

// Import Internal Dependencies
import { toUnitColor } from "../utils/colors.ts";
import { clamp } from "../utils/math.ts";
import type {
  ByteColorInput,
  RGBA8,
  Vec2
} from "../types.ts";

export class BrushColor {
  #color: RGBA;
  #opacity: number;
  #rgba: RGBA8;

  constructor(
    color: ByteColorInput,
    opacity: number = 1
  ) {
    this.#color = opaqueColor(color);
    this.#opacity = clamp(opacity, 0, 1);
    this.#rgba = this.#readRgba();
  }

  set(
    color: ByteColorInput,
    opacity?: number
  ): void {
    this.#color = opaqueColor(color);
    if (opacity !== undefined) {
      this.#opacity = clamp(opacity, 0, 1);
    }
    this.#rgba = this.#readRgba();
  }

  #readRgba(): RGBA8 {
    return toRGBA8({
      ...this.#color,
      a: this.#opacity
    });
  }

  asRGBA(): RGBA8 {
    return { ...this.#rgba };
  }

  asString(
    format: "rgba" | "hex" = "rgba"
  ): string {
    if (format === "hex") {
      return formatHex(this.#color);
    }

    return formatRgba({
      ...this.#color,
      a: this.#opacity
    });
  }

  set opacity(
    opacity: number
  ) {
    this.#opacity = clamp(opacity, 0, 1);
    this.#rgba = this.#readRgba();
  }

  get opacity(): number {
    return this.#opacity;
  }
}

function opaqueColor(
  color: ByteColorInput
): RGBA {
  return {
    ...toUnitColor(color),
    a: 1
  };
}

export type BrushColorSlot = "primary" | "secondary";

export type BrushPaintSource = BrushColorSlot | "erase";

export interface BrushOptions {
  /**
   * Primary brush color.
   * @default "#000000"
   */
  color?: ByteColorInput;
  /**
   * Secondary brush color.
   * @default "#FFFFFF"
   */
  secondaryColor?: ByteColorInput;
  /**
   * Color written in erase mode.
   * @default transparent
   */
  eraseColor?: ByteColorInput;
  /**
   * Brush size in pixels.
   * @default 32
   */
  size?: number;
  /**
   * Maximum brush size.
   * @default 32
   */
  maxSize?: number;
  /**
   * Brush highlight colors.
   * @default { colorInline: "#FFF", colorOutline: "#000" }
   */
  highlight?: {
    colorInline?: ByteColorInput;
    colorOutline?: ByteColorInput;
  };
}

export class Brush {
  readonly primary: BrushColor;
  readonly secondary: BrushColor;
  readonly erase: BrushColor;
  #size: number;
  #maxSize: number;
  #colorInline: string;
  #colorOutline: string;

  constructor(
    options: BrushOptions = {}
  ) {
    const {
      color = "#000000",
      secondaryColor = "#FFFFFF",
      eraseColor,
      size = 32,
      maxSize = 32,
      highlight = {
        colorInline: "#FFF",
        colorOutline: "#000"
      }
    } = options;

    this.primary = new BrushColor(color);
    this.secondary = new BrushColor(secondaryColor);
    this.erase = eraseColor === undefined ?
      new BrushColor("#000000", 0) :
      new BrushColor(eraseColor);
    this.#maxSize = Math.max(maxSize, 1);
    this.size = size;

    this.colorInline = highlight.colorInline ?? "#FFF";
    this.colorOutline = highlight.colorOutline ?? "#000";
  }

  colorFor(
    source: BrushPaintSource
  ): RGBA8 {
    return this[source].asRGBA();
  }

  swapColors(): void {
    const primaryHex = this.primary.asString("hex");
    const primaryOpacity = this.primary.opacity;

    this.primary.set(
      this.secondary.asString("hex"),
      this.secondary.opacity
    );
    this.secondary.set(primaryHex, primaryOpacity);
  }

  set colorInline(
    color: ByteColorInput
  ) {
    this.#colorInline = formatRgb(toUnitColor(color));
  }

  get colorInline(): string {
    return this.#colorInline;
  }

  set colorOutline(
    color: ByteColorInput
  ) {
    this.#colorOutline = formatRgb(toUnitColor(color));
  }

  get colorOutline(): string {
    return this.#colorOutline;
  }

  set size(
    size: number
  ) {
    this.#size = clamp(size, 1, this.#maxSize);
  }

  get size(): number {
    return this.#size;
  }

  * affectedPixels(
    x: number,
    y: number
  ): IterableIterator<Vec2> {
    const half = Math.floor(this.#size / 2);
    if (this.#size % 2 === 0) {
      for (let dx = -half; dx < half; dx++) {
        for (let dy = -half; dy < half; dy++) {
          yield { x: x + dx, y: y + dy };
        }
      }

      return;
    }

    for (let dx = -half; dx <= half; dx++) {
      for (let dy = -half; dy <= half; dy++) {
        yield { x: x + dx, y: y + dy };
      }
    }
  }
}
