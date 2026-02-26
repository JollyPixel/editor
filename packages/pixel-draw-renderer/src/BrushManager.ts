// Import Internal Dependencies
import { getColorAsRGBA } from "./utils.ts";
import type { Vec2 } from "./types.ts";

export interface BrushManagerOptions {
  /**
   * Base color of the brush. Can be any valid CSS color string.
   * Opacity can be controlled separately with the `opacity` property.
   * @default "#000000"
   */
  color?: string;
  /**
   * Size of the brush in pixels. Must be a positive integer.
   * The actual affected area will be a square of `size x size` pixels centered around the target pixel.
   * @default 32
   */
  size?: number;
  /**
   * Maximum allowed size for the brush. This is used to constrain the `size` property.
   * Must be a positive integer. If `size` is set higher than `maxSize`, it will be clamped to `maxSize`.
   * @default 32
   */
  maxSize?: number;
  /**
   * Highlight colors for the brush preview.
   * These colors are used to render the brush outline and fill when hovering over the canvas.
   * @default { colorInline: "#FFF", colorOutline: "#000" }
   */
  highlight?: {
    colorInline?: string;
    colorOutline?: string;
  };
}

/**
 * Manages brush properties such as color, size, and opacity for a pixel drawing application.
 * Provides methods to set and get these properties, as well as to calculate the affected pixels based on the brush size.
 */
export class BrushManager {
  #color: string;
  #colorHex: string;
  #opacity: number;
  #size: number;
  #maxSize: number;
  #colorInline: string;
  #colorOutline: string;

  constructor(
    options: BrushManagerOptions = {}
  ) {
    const {
      color = "#000000",
      size = 32,
      maxSize = 32,
      highlight = {
        colorInline: "#FFF",
        colorOutline: "#000"
      }
    } = options;

    this.setColor(color);
    this.#maxSize = Math.max(maxSize, 1);
    this.setSize(size);
    this.#opacity = 1;

    this.setColorInline(highlight.colorInline || "#FFF");
    this.setColorOutline(highlight.colorOutline || "#000");
  }

  setColor(
    color: string
  ): void {
    this.#colorHex = color;
    const [r, g, b] = getColorAsRGBA(color);
    this.#color = `rgba(${r}, ${g}, ${b}, ${this.#opacity})`;
  }

  setColorWithOpacity(
    color: string,
    opacity: number
  ): void {
    this.#colorHex = color;
    const [r, g, b] = getColorAsRGBA(color);
    this.#opacity = Math.max(0, Math.min(1, opacity));
    this.#color = `rgba(${r}, ${g}, ${b}, ${this.#opacity})`;
  }

  getColor(): string {
    return this.#color;
  }

  getColorHex(): string {
    return this.#colorHex;
  }

  setOpacity(
    opacity: number
  ): void {
    this.#opacity = Math.max(0, Math.min(1, opacity));

    const [r, g, b] = getColorAsRGBA(this.#colorHex);
    this.#color = `rgba(${r}, ${g}, ${b}, ${this.#opacity})`;
  }

  getOpacity(): number {
    return this.#opacity;
  }

  setColorInline(
    color: string
  ): void {
    const [r, g, b] = getColorAsRGBA(color);
    this.#colorInline = `rgb(${r}, ${g}, ${b})`;
  }

  getColorInline(): string {
    return this.#colorInline;
  }

  setColorOutline(
    color: string
  ): void {
    const [r, g, b] = getColorAsRGBA(color);
    this.#colorOutline = `rgb(${r}, ${g}, ${b})`;
  }

  getColorOutline(): string {
    return this.#colorOutline;
  }

  setSize(
    size: number
  ): void {
    this.#size = Math.max(1, Math.min(this.#maxSize, size));
  }

  getSize(): number {
    return this.#size;
  }

  getAffectedPixels(
    x: number,
    y: number
  ): Vec2[] {
    const pixels: Vec2[] = [];

    const half = Math.floor(this.#size / 2);
    if (this.#size % 2 === 0) {
      for (let dx = -half; dx < half; dx++) {
        for (let dy = -half; dy < half; dy++) {
          pixels.push({ x: x + dx, y: y + dy });
        }
      }

      return pixels;
    }

    for (let dx = -half; dx <= half; dx++) {
      for (let dy = -half; dy <= half; dy++) {
        pixels.push({ x: x + dx, y: y + dy });
      }
    }

    return pixels;
  }
}
