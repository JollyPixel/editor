// Import Third-party Dependencies
import Color from "colorjs.io";

// Import Internal Dependencies
import { colorAsRGBA } from "../utils/colors.ts";
import { clamp } from "../utils/math.ts";
import type {
  ColorInput,
  Vec2
} from "../types.ts";

export class BrushColor {
  #color: Color;

  constructor(
    color: ColorInput,
    opacity: number = 1
  ) {
    this.#color = new Color(color);
    this.#color.alpha = clamp(opacity, 0, 1);
  }

  set(
    color: ColorInput,
    opacity?: number
  ): void {
    const alpha = opacity === undefined ?
      this.#color.alpha :
      clamp(opacity, 0, 1);
    this.#color = new Color(color);
    this.#color.alpha = alpha;
  }

  asString(
    format: "rgba" | "hex" = "rgba"
  ): string {
    if (format === "hex") {
      return this.#color.toString({
        format: "hex",
        collapse: false,
        alpha: false
      });
    }

    const [r, g, b] = colorAsRGBA(this.#color);

    return `rgba(${r}, ${g}, ${b}, ${this.#color.alpha})`;
  }

  set opacity(
    opacity: number
  ) {
    this.#color.alpha = clamp(opacity, 0, 1);
  }

  get opacity(): number {
    return this.#color.alpha;
  }
}

export type BrushColorSlot = "primary" | "secondary";

export interface BrushOptions {
  /**
   * Primary brush color.
   * @default "#000000"
   */
  color?: ColorInput;
  /**
   * Secondary brush color.
   * @default "#FFFFFF"
   */
  secondaryColor?: ColorInput;
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
    colorInline?: ColorInput;
    colorOutline?: ColorInput;
  };
}

export class Brush {
  readonly primary: BrushColor;
  readonly secondary: BrushColor;
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
      size = 32,
      maxSize = 32,
      highlight = {
        colorInline: "#FFF",
        colorOutline: "#000"
      }
    } = options;

    this.primary = new BrushColor(color);
    this.secondary = new BrushColor(secondaryColor);
    this.#maxSize = Math.max(maxSize, 1);
    this.size = size;

    this.colorInline = highlight.colorInline ?? "#FFF";
    this.colorOutline = highlight.colorOutline ?? "#000";
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
    color: ColorInput
  ) {
    const [r, g, b] = colorAsRGBA(color);
    this.#colorInline = `rgb(${r}, ${g}, ${b})`;
  }

  get colorInline(): string {
    return this.#colorInline;
  }

  set colorOutline(
    color: ColorInput
  ) {
    const [r, g, b] = colorAsRGBA(color);
    this.#colorOutline = `rgb(${r}, ${g}, ${b})`;
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
