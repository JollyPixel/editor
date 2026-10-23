// Import Internal Dependencies
import { hashKey } from "./hashKey.ts";
import { hslToRgb } from "../convert/hsl.ts";
import { formatHex } from "../format.ts";

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
const kGoldenAngle = 137.5;
const kDefaultLightness = 0.7;
const kDefaultSaturation = 0.72;

export interface GoldenAngleOptions {
  /**
   * @default 0.72
   */
  saturation?: number;
  /**
   * @default 0.7
   */
  lightness?: number;
}

export class ColorSequence {
  static readonly default = ColorSequence.from(kDefaultColors);

  static from(
    colors: readonly string[]
  ): ColorSequence {
    if (colors.length === 0) {
      throw new RangeError("A color sequence needs at least one color");
    }

    const copy = [...colors];

    return new ColorSequence(
      (index) => copy[((index % copy.length) + copy.length) % copy.length]
    );
  }

  static goldenAngle(
    options: GoldenAngleOptions = {}
  ): ColorSequence {
    const {
      saturation = kDefaultSaturation,
      lightness = kDefaultLightness
    } = options;

    return new ColorSequence(
      (index) => formatHex(hslToRgb({
        h: index * kGoldenAngle,
        s: saturation,
        l: lightness,
        a: 1
      }))
    );
  }

  readonly #colorAt: (index: number) => string;

  constructor(
    colorAt: (index: number) => string
  ) {
    this.#colorAt = colorAt;
  }

  at(
    index: number
  ): string {
    return this.#colorAt(Math.trunc(index));
  }

  pick(
    key: string
  ): string {
    return this.#colorAt(hashKey(key));
  }
}
