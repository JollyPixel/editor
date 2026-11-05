// Import Third-party Dependencies
import {
  Color,
  HueSpace,
  type HSVA,
  type HueSpaceName
} from "@jolly-pixel/color";

// CONSTANTS
const kHueRampSteps = 12;
const kValueRampSteps = 6;
const kTurn = 360;
const kAxisLabels = {
  value: "Value",
  lightness: "Lightness"
} as const;

export type ColorPickerSpace = HueSpaceName;

export class PickerSpace {
  static readonly hsv = new PickerSpace(HueSpace.hsv);
  static readonly okhsv = new PickerSpace(HueSpace.okhsv);
  static readonly okhsl = new PickerSpace(HueSpace.okhsl);

  static named(
    name: ColorPickerSpace
  ): PickerSpace {
    switch (name) {
      case "okhsv":
        return PickerSpace.okhsv;
      case "okhsl":
        return PickerSpace.okhsl;
      default:
        return PickerSpace.hsv;
    }
  }

  readonly model: HueSpace;
  readonly axisLabel: typeof kAxisLabels[keyof typeof kAxisLabels];
  #hueRamp: string | null = null;

  constructor(
    model: HueSpace
  ) {
    this.model = model;
    this.axisLabel = kAxisLabels[model.level];
  }

  get hueRamp(): string {
    this.#hueRamp ??= Array.from(
      { length: kHueRampSteps + 1 },
      (_, index) => this.hex({
        h: (index / kHueRampSteps) * kTurn,
        s: 1,
        v: this.model.pureLevel,
        a: 1
      })
    ).join(", ");

    return this.#hueRamp;
  }

  hex(
    point: HSVA
  ): string {
    return new Color(this.model.toRgb(point)).hex();
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
}
