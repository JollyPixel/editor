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

export type ColorPickerSpace = "hsv" | "okhsv" | "okhsl";

interface PointModel {
  toRgb(point: HSVA): RGBA;
  fromRgb(color: RGBA, previous?: HSVA): HSVA;
}

interface PickerAxis {
  label: "Value" | "Lightness";
  pure: number;
}

const kValueAxis: PickerAxis = {
  label: "Value",
  pure: 1
};

const kOkhslModel: PointModel = {
  toRgb: (point) => ColorSpace.okhsl.toRgb({
    h: point.h,
    s: point.s,
    l: point.v,
    a: point.a
  }),
  fromRgb: (color, previous) => {
    const { h, s, l, a } = ColorSpace.okhsl.fromRgb(
      color,
      previous && {
        h: previous.h,
        s: previous.s,
        l: previous.v,
        a: previous.a
      }
    );

    return {
      h,
      s,
      v: l,
      a
    };
  }
};

export class PickerSpace {
  static readonly hsv = new PickerSpace("hsv", ColorSpace.hsv, kValueAxis);
  static readonly okhsv = new PickerSpace("okhsv", ColorSpace.okhsv, kValueAxis);
  static readonly okhsl = new PickerSpace("okhsl", kOkhslModel, {
    label: "Lightness",
    pure: 0.5
  });

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

  readonly name: ColorPickerSpace;
  readonly axisLabel: PickerAxis["label"];
  readonly pureLevel: number;
  readonly #model: PointModel;
  #hueRamp: string | null = null;

  constructor(
    name: ColorPickerSpace,
    model: PointModel,
    axis: PickerAxis
  ) {
    this.name = name;
    this.#model = model;
    this.axisLabel = axis.label;
    this.pureLevel = axis.pure;
  }

  get hueRamp(): string {
    this.#hueRamp ??= Array.from(
      { length: kHueRampSteps + 1 },
      (_, index) => this.hex({
        h: (index / kHueRampSteps) * kTurn,
        s: 1,
        v: this.pureLevel,
        a: 1
      })
    ).join(", ");

    return this.#hueRamp;
  }

  toRgb(
    point: HSVA
  ): RGBA {
    return this.#model.toRgb(point);
  }

  hex(
    point: HSVA
  ): string {
    return formatHex(this.#model.toRgb(point));
  }

  fromRgb(
    color: RGBA,
    previous?: HSVA
  ): HSVA {
    return this.#model.fromRgb(color, previous);
  }

  pureHue(
    point: HSVA
  ): RGBA {
    return this.#model.toRgb({
      h: point.h,
      s: 1,
      v: this.pureLevel,
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
      this.#model.toRgb(point),
      point
    );
  }
}
