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
import type { RGBA } from "../types.ts";

// CONSTANTS
const kWhiteEdge = 1 - 1e-6;

export type HueColor<TChannel extends string> = Record<
  TChannel | "h" | "a",
  number
>;

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
  readonly channels: readonly TChannel[];
  readonly #init: ColorSpaceInit<TChannel>;

  constructor(
    init: ColorSpaceInit<TChannel>
  ) {
    this.name = init.name;
    this.channels = init.channels;
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

  static #isLightnessEdge(
    lightness: number
  ): boolean {
    return lightness <= 0 || lightness >= kWhiteEdge;
  }
}
