// Import Internal Dependencies
import {
  colorFromKey,
  defaultPaletteColors
} from "./deterministic.ts";

export interface ColorPaletteOptions {
  /**
   * @default a built-in 8-color palette
   */
  colors?: string[];
}

export class ColorPalette {
  /**
   * Stores a frozen copy so exposed colors cannot mutate the palette.
   */
  readonly colors: readonly string[];

  #index = 0;

  constructor(
    options: ColorPaletteOptions = {}
  ) {
    this.colors = Object.freeze([
      ...options.colors ?? defaultPaletteColors()
    ]);
  }

  next(): string {
    const color = this.colors[
      this.#index % this.colors.length
    ];
    this.#index++;

    return color;
  }

  forKey(
    key: string
  ): string {
    return colorFromKey(key, this.colors);
  }

  reset(): void {
    this.#index = 0;
  }
}
