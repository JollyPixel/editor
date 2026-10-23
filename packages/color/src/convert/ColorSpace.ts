// Import Internal Dependencies
import {
  hslToRgb,
  rgbToHsl
} from "./hsl.ts";
import {
  hsvToRgb,
  rgbToHsv
} from "./hsv.ts";
import {
  hwbToRgb,
  rgbToHwb
} from "./hwb.ts";
import {
  okhslToRgb,
  rgbToOkhsl
} from "./oklab/okhsl.ts";
import {
  okhsvToRgb,
  rgbToOkhsv
} from "./oklab/okhsv.ts";
import {
  oklchToRgb,
  rgbToOklch
} from "./oklab/oklch.ts";
import {
  clampUnit,
  lerp
} from "../math.ts";
import type { RGBA } from "../types.ts";

// CONSTANTS
const kTurn = 360;
const kHalfTurn = 180;
const kWhiteEdge = 1 - 1e-6;

export type HueColor<TChannel extends string> = Record<
  TChannel | "h" | "a",
  number
>;

export type HueInterpolation =
  | "shorter"
  | "longer"
  | "increasing"
  | "decreasing";

export interface ColorSpaces {
  hsv: ColorSpace<"s" | "v">;
  okhsv: ColorSpace<"s" | "v">;
  hsl: ColorSpace<"s" | "l">;
  okhsl: ColorSpace<"s" | "l">;
  hwb: ColorSpace<"w" | "b">;
  oklch: ColorSpace<"l" | "c">;
}

export type ColorSpaceName = keyof ColorSpaces;

export interface PowerlessRule<TChannel extends string> {
  channel: TChannel | "h";
  when: (color: HueColor<TChannel>) => boolean;
}

export interface ColorSpaceInit<TChannel extends string> {
  name: string;
  channels: readonly TChannel[];
  toRgb: (color: HueColor<TChannel>) => RGBA;
  fromRgb: (color: RGBA) => HueColor<TChannel>;
  powerless: readonly PowerlessRule<TChannel>[];
}

export class ColorSpace<TChannel extends string> {
  static readonly hsv = new ColorSpace<"s" | "v">({
    name: "hsv",
    channels: ["s", "v"],
    toRgb: hsvToRgb,
    fromRgb: rgbToHsv,
    powerless: [
      {
        channel: "h",
        when: (color) => color.s === 0 || color.v === 0
      },
      {
        channel: "s",
        when: (color) => color.v === 0
      }
    ]
  });

  static readonly okhsv = new ColorSpace<"s" | "v">({
    name: "okhsv",
    channels: ["s", "v"],
    toRgb: okhsvToRgb,
    fromRgb: rgbToOkhsv,
    powerless: ColorSpace.hsv.#init.powerless
  });

  static readonly hsl = new ColorSpace<"s" | "l">({
    name: "hsl",
    channels: ["s", "l"],
    toRgb: hslToRgb,
    fromRgb: rgbToHsl,
    powerless: [
      {
        channel: "h",
        when: (color) => color.s === 0 || ColorSpace.#isLightnessEdge(color.l)
      },
      {
        channel: "s",
        when: (color) => ColorSpace.#isLightnessEdge(color.l)
      }
    ]
  });

  static readonly okhsl = new ColorSpace<"s" | "l">({
    name: "okhsl",
    channels: ["s", "l"],
    toRgb: okhslToRgb,
    fromRgb: rgbToOkhsl,
    powerless: ColorSpace.hsl.#init.powerless
  });

  static readonly hwb = new ColorSpace<"w" | "b">({
    name: "hwb",
    channels: ["w", "b"],
    toRgb: hwbToRgb,
    fromRgb: rgbToHwb,
    powerless: [
      {
        channel: "h",
        when: (color) => color.w + color.b >= 1
      }
    ]
  });

  static readonly oklch = new ColorSpace<"l" | "c">({
    name: "oklch",
    channels: ["l", "c"],
    toRgb: oklchToRgb,
    fromRgb: rgbToOklch,
    powerless: [
      {
        channel: "h",
        when: (color) => color.c === 0
      }
    ]
  });

  static readonly #spaces: ColorSpaces = {
    hsv: ColorSpace.hsv,
    okhsv: ColorSpace.okhsv,
    hsl: ColorSpace.hsl,
    okhsl: ColorSpace.okhsl,
    hwb: ColorSpace.hwb,
    oklch: ColorSpace.oklch
  };

  static named<TName extends ColorSpaceName>(
    name: TName
  ): ColorSpaces[TName] {
    return ColorSpace.#spaces[name];
  }

  readonly name: string;
  readonly #init: ColorSpaceInit<TChannel>;

  constructor(
    init: ColorSpaceInit<TChannel>
  ) {
    this.name = init.name;
    this.#init = init;
  }

  toRgb(
    color: HueColor<TChannel>
  ): RGBA {
    return this.#init.toRgb(color);
  }

  fromRgb(
    color: RGBA,
    previous?: Partial<HueColor<TChannel>>
  ): HueColor<TChannel> {
    const converted = this.#init.fromRgb(color);

    return previous === undefined ?
      converted :
      this.#carry(converted, (channel) => previous[channel]);
  }

  mix(
    from: RGBA,
    to: RGBA,
    amount: number,
    hue: HueInterpolation = "shorter"
  ): RGBA {
    const t = clampUnit(amount);
    const source = this.#init.fromRgb(from);
    const target = this.#init.fromRgb(to);
    const start = this.#carry(
      source,
      (channel) => (channel === "h" ? target.h : undefined)
    );
    const end = this.#carry(
      target,
      (channel) => (channel === "h" ? start.h : undefined)
    );
    const [first, second] = ColorSpace.#hueArc(start.h, end.h, hue);
    const mixed: HueColor<TChannel> = {
      ...start,
      h: lerp(first, second, t),
      a: lerp(start.a, end.a, t)
    };
    for (const channel of this.#init.channels) {
      mixed[channel] = lerp(start[channel], end[channel], t);
    }

    return this.#init.toRgb(mixed);
  }

  #carry(
    color: HueColor<TChannel>,
    previous: (channel: TChannel | "h") => number | undefined
  ): HueColor<TChannel> {
    const carried = {
      ...color
    };
    for (const { channel, when } of this.#init.powerless) {
      const value = previous(channel);
      if (value !== undefined && when(color)) {
        carried[channel] = value;
      }
    }

    return carried;
  }

  static #hueArc(
    first: number,
    second: number,
    method: HueInterpolation
  ): [number, number] {
    const delta = second - first;
    switch (method) {
      case "longer":
        if (delta > 0 && delta < kHalfTurn) {
          return [first + kTurn, second];
        }
        if (delta > -kHalfTurn && delta <= 0) {
          return [first, second + kTurn];
        }

        return [first, second];
      case "increasing":
        return second < first ? [first, second + kTurn] : [first, second];
      case "decreasing":
        return first < second ? [first + kTurn, second] : [first, second];
      default:
        if (delta > kHalfTurn) {
          return [first + kTurn, second];
        }
        if (delta < -kHalfTurn) {
          return [first, second + kTurn];
        }

        return [first, second];
    }
  }

  static #isLightnessEdge(
    lightness: number
  ): boolean {
    return lightness <= 0 || lightness >= kWhiteEdge;
  }
}
