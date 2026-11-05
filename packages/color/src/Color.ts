// Import Internal Dependencies
import { toByte } from "./convert/bytes.ts";
import { rgbToHsl } from "./convert/hsl.ts";
import { rgbToOklch } from "./convert/oklab/oklch.ts";
import { srgbToLinear } from "./convert/srgb.ts";
import {
  formatHex,
  formatHsl,
  formatOklch,
  formatRgb,
  formatRgba
} from "./format.ts";
import {
  BYTE_MAX,
  clampUnit
} from "./math.ts";
import {
  shadeRamp,
  type ShadeRampOptions
} from "./mix/shade.ts";
import { parseColor } from "./parse/parseColor.ts";
import { ColorParseError } from "./parse/errors/ColorParseError.ts";
import type {
  ByteColorInput,
  ColorInput,
  kChannelScale,
  RGBA,
  RGBA8
} from "./types.ts";

// CONSTANTS
const kLuminanceWeights = {
  r: 0.2126,
  g: 0.7152,
  b: 0.0722
};
const kContrastOffset = 0.05;
const kAmbiguousHex = /^#?[0-9a-f]{4}$/i;

export class Color implements RGBA {
  static readonly black = new Color({
    r: 0,
    g: 0,
    b: 0,
    a: 1
  });

  static readonly white = new Color({
    r: 1,
    g: 1,
    b: 1,
    a: 1
  });

  static parse(
    input: string
  ): Color | null {
    const parsed = parseColor(input);

    return parsed === null ? null : new Color(parsed);
  }

  static from(
    input: ColorInput
  ): Color {
    if (typeof input !== "string") {
      return input instanceof Color ? input : new Color(input);
    }

    const parsed = Color.parse(input);
    if (parsed === null) {
      throw new ColorParseError(input);
    }

    return parsed;
  }

  static parseDraft(
    draft: string
  ): Color | null {
    return kAmbiguousHex.test(draft.trim()) ? null : Color.parse(draft);
  }

  static fromBytes(
    input: ByteColorInput
  ): Color {
    if (typeof input === "string") {
      return Color.from(input);
    }

    return new Color({
      r: input.r / BYTE_MAX,
      g: input.g / BYTE_MAX,
      b: input.b / BYTE_MAX,
      a: input.a / BYTE_MAX
    });
  }

  declare readonly [kChannelScale]?: "unit";
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;

  constructor(
    color: RGBA
  ) {
    this.r = color.r;
    this.g = color.g;
    this.b = color.b;
    this.a = color.a;
  }

  withAlpha(
    alpha: number
  ): Color {
    return new Color({
      r: this.r,
      g: this.g,
      b: this.b,
      a: alpha
    });
  }

  over(
    backdrop: RGBA
  ): Color {
    const alpha = clampUnit(this.a);
    const below = clampUnit(backdrop.a) * (1 - alpha);
    const total = alpha + below;
    if (total === 0) {
      return Color.black.withAlpha(0);
    }

    return new Color({
      r: ((this.r * alpha) + (backdrop.r * below)) / total,
      g: ((this.g * alpha) + (backdrop.g * below)) / total,
      b: ((this.b * alpha) + (backdrop.b * below)) / total,
      a: total
    });
  }

  contrastWith(
    other: RGBA
  ): number {
    return Color.#luminanceRatio(
      Color.#luminance(this),
      Color.#luminance(other)
    );
  }

  ink(): Color {
    const luminance = Color.#luminance(this);
    const onBlack = Color.#luminanceRatio(luminance, 0);
    const onWhite = Color.#luminanceRatio(1, luminance);

    return onBlack >= onWhite ? Color.black : Color.white;
  }

  shadeRamp(
    options: ShadeRampOptions = {}
  ): Color[] {
    return shadeRamp(this, options).map((color) => new Color(color));
  }

  toBytes(): RGBA8 {
    return {
      r: toByte(this.r),
      g: toByte(this.g),
      b: toByte(this.b),
      a: toByte(this.a)
    };
  }

  hex(
    withAlpha = false
  ): string {
    return formatHex(this, withAlpha);
  }

  rgb(): string {
    return formatRgb(this);
  }

  rgba(): string {
    return formatRgba(this);
  }

  hsl(): string {
    return formatHsl(rgbToHsl(this));
  }

  oklch(): string {
    return formatOklch(rgbToOklch(this));
  }

  static #luminance(
    color: RGBA
  ): number {
    return (kLuminanceWeights.r * srgbToLinear(clampUnit(color.r))) +
      (kLuminanceWeights.g * srgbToLinear(clampUnit(color.g))) +
      (kLuminanceWeights.b * srgbToLinear(clampUnit(color.b)));
  }

  static #luminanceRatio(
    first: number,
    second: number
  ): number {
    return (Math.max(first, second) + kContrastOffset) /
      (Math.min(first, second) + kContrastOffset);
  }
}
