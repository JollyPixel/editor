// Import Third-party Dependencies
import {
  ColorSpace,
  formatHex,
  type HSVA,
  type RGBA
} from "@jolly-pixel/color";

// CONSTANTS
const kHueRampSteps = 12;
const kValueRampSteps = 6;
const kTurn = 360;

export type ColorPickerSpace = "hsv" | "okhsv";

export class PickerSpace {
  static readonly hsv = new PickerSpace("hsv", ColorSpace.hsv);
  static readonly okhsv = new PickerSpace("okhsv", ColorSpace.okhsv);

  static named(
    name: ColorPickerSpace
  ): PickerSpace {
    return name === "okhsv" ? PickerSpace.okhsv : PickerSpace.hsv;
  }

  readonly name: ColorPickerSpace;
  readonly #space: ColorSpace<"s" | "v">;
  #hueRamp: string | null = null;

  constructor(
    name: ColorPickerSpace,
    space: ColorSpace<"s" | "v">
  ) {
    this.name = name;
    this.#space = space;
  }

  get hueRamp(): string {
    this.#hueRamp ??= Array.from(
      { length: kHueRampSteps + 1 },
      (_, index) => this.hex({
        h: (index / kHueRampSteps) * kTurn,
        s: 1,
        v: 1,
        a: 1
      })
    ).join(", ");

    return this.#hueRamp;
  }

  toRgb(
    point: HSVA
  ): RGBA {
    return this.#space.toRgb(point);
  }

  hex(
    point: HSVA
  ): string {
    return formatHex(this.#space.toRgb(point));
  }

  fromRgb(
    color: RGBA,
    previous?: HSVA
  ): HSVA {
    return this.#space.fromRgb(color, previous);
  }

  pureHue(
    point: HSVA
  ): RGBA {
    return this.#space.toRgb({
      h: point.h,
      s: 1,
      v: 1,
      a: 1
    });
  }

  valueRamp(
    point: HSVA
  ): string {
    return Array.from(
      { length: kValueRampSteps + 1 },
      (_, index) => this.hex({
        ...point,
        v: index / kValueRampSteps
      })
    ).join(", ");
  }

  convert(
    point: HSVA,
    target: PickerSpace
  ): HSVA {
    if (target === this) {
      return point;
    }

    return target.fromRgb(
      this.#space.toRgb(point),
      point
    );
  }
}
