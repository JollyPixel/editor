// CONSTANTS
const kDefaultColors = [
  "#f94144",
  "#f3722c",
  "#f9c74f",
  "#90be6d",
  "#43aa8b",
  "#4d908e",
  "#577590",
  "#277da1"
];

export interface ColorPaletteOptions {
  /**
   * @default a built-in 8-color palette
   */
  colors?: string[];
}

/**
 * Dispatches colors from a fixed, curated palette
 */
export class ColorPalette {
  #colors: string[];
  #index = 0;

  constructor(
    options: ColorPaletteOptions = {}
  ) {
    this.#colors = options.colors ?? kDefaultColors;
  }

  next(): string {
    const color = this.#colors[this.#index % this.#colors.length];
    this.#index++;

    return color;
  }

  /**
   * Deterministic color for an arbitrary key (e.g. a network client id).
   */
  forKey(
    key: string
  ): string {
    return this.#colors[ColorPalette.#hash(key) % this.#colors.length];
  }

  reset(): void {
    this.#index = 0;
  }

  static #hash(
    value: string
  ): number {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash * 31 + value.charCodeAt(i)) | 0;
    }

    return Math.abs(hash);
  }
}
