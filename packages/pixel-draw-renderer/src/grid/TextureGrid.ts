// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import { toCssColor } from "../utils/colors.ts";
import type { ByteColorInput } from "../types.ts";

// CONSTANTS
const kDefaultSize = 16;
const kDefaultColor = "rgba(0, 0, 0, 0.45)";

export interface TextureGridOptions {
  /**
   * Cell size in texture pixels, rounded to a positive integer.
   * @default 16
   */
  size?: number;
  /**
   * @default false
   */
  visible?: boolean;
  /**
   * Whether UV drags and resizes snap to cell lines.
   * @default false
   */
  snap?: boolean;
  /**
   * @default "rgba(0, 0, 0, 0.45)"
   */
  color?: ByteColorInput;
}

export type TextureGridEvent = {
  changed: () => void;
};

export class TextureGrid extends Emitter<TextureGridEvent> {
  #size: number;
  #visible: boolean;
  #snap: boolean;
  #color: string;

  constructor(
    options: TextureGridOptions = {}
  ) {
    super();
    this.#size = cellSize(options.size ?? kDefaultSize, kDefaultSize);
    this.#visible = options.visible ?? false;
    this.#snap = options.snap ?? false;
    this.#color = toCssColor(options.color ?? kDefaultColor);
  }

  get size(): number {
    return this.#size;
  }

  set size(
    value: number
  ) {
    const size = cellSize(value, this.#size);
    if (size !== this.#size) {
      this.#size = size;
      this.emit("changed");
    }
  }

  get visible(): boolean {
    return this.#visible;
  }

  set visible(
    value: boolean
  ) {
    if (value !== this.#visible) {
      this.#visible = value;
      this.emit("changed");
    }
  }

  get snap(): boolean {
    return this.#snap;
  }

  set snap(
    value: boolean
  ) {
    if (value !== this.#snap) {
      this.#snap = value;
      this.emit("changed");
    }
  }

  get color(): string {
    return this.#color;
  }

  set color(
    value: ByteColorInput
  ) {
    const color = toCssColor(value);
    if (color !== this.#color) {
      this.#color = color;
      this.emit("changed");
    }
  }

  nearestLine(
    value: number
  ): number {
    return Math.round(value / this.#size) * this.#size || 0;
  }
}

function cellSize(
  value: number,
  fallback: number
): number {
  return Number.isFinite(value) ? Math.max(1, Math.round(value)) : fallback;
}
