// Import Internal Dependencies
import { Color } from "../Color.ts";
import {
  ColorSpace,
  type ColorSpaceName,
  type HueColor
} from "../convert/ColorSpace.ts";
import {
  oklabToRgb,
  rgbToOklab
} from "../convert/oklab/oklab.ts";
import {
  linearToSrgb,
  srgbToLinear
} from "../convert/srgb.ts";
import {
  hueArc,
  type HueInterpolation
} from "../hue.ts";
import {
  clampUnit,
  lerp
} from "../math.ts";
import type { RGBA } from "../types.ts";

export type MixSpace = "srgb" | "linear" | "oklab" | ColorSpaceName;

export interface MixOptions {
  /**
   * @default "oklab"
   */
  space?: MixSpace;
  /**
   * Hue path for the hue-based spaces.
   * @default "shorter"
   */
  hue?: HueInterpolation;
}

type Blend = (t: number) => RGBA;

interface HueSpace {
  readonly channels: readonly string[];
  fromRgb(color: RGBA, previous?: Partial<HueColor<string>>): HueColor<string>;
  toRgb(color: HueColor<string>): RGBA;
}

export class Gradient {
  static between(
    from: RGBA,
    to: RGBA,
    options: MixOptions = {}
  ): Gradient {
    const { space = "oklab", hue = "shorter" } = options;
    switch (space) {
      case "srgb":
        return new Gradient(Gradient.#channels(from, to, clampUnit, clampUnit));
      case "linear":
        return new Gradient(Gradient.#channels(from, to, Gradient.#toLinear, linearToSrgb));
      case "oklab":
        return new Gradient(Gradient.#oklab(from, to));
      default:
        return new Gradient(Gradient.#hue(ColorSpace.named(space), from, to, hue));
    }
  }

  readonly #blend: Blend;

  constructor(
    blend: Blend
  ) {
    this.#blend = blend;
  }

  at(
    amount: number
  ): Color {
    return new Color(this.#blend(clampUnit(amount)));
  }

  steps(
    count: number
  ): Color[] {
    if (!Number.isInteger(count) || count < 2) {
      throw new RangeError("A gradient needs an integer count of at least 2 steps");
    }

    return Array.from(
      { length: count },
      (_, index) => new Color(this.#blend(index / (count - 1)))
    );
  }

  static #channels(
    from: RGBA,
    to: RGBA,
    encode: (channel: number) => number,
    decode: (channel: number) => number
  ): Blend {
    const start = Gradient.#encode(from, encode);
    const end = Gradient.#encode(to, encode);

    return (t) => {
      return {
        r: decode(lerp(start.r, end.r, t)),
        g: decode(lerp(start.g, end.g, t)),
        b: decode(lerp(start.b, end.b, t)),
        a: lerp(start.a, end.a, t)
      };
    };
  }

  static #oklab(
    from: RGBA,
    to: RGBA
  ): Blend {
    const start = rgbToOklab(from);
    const end = rgbToOklab(to);
    const alpha = clampUnit(from.a);
    const endAlpha = clampUnit(to.a);

    return (t) => oklabToRgb(
      {
        l: lerp(start.l, end.l, t),
        a: lerp(start.a, end.a, t),
        b: lerp(start.b, end.b, t)
      },
      lerp(alpha, endAlpha, t)
    );
  }

  static #hue(
    space: HueSpace,
    from: RGBA,
    to: RGBA,
    method: HueInterpolation
  ): Blend {
    const target = space.fromRgb(to);
    const start = space.fromRgb(from, { h: target.h });
    const end = space.fromRgb(to, { h: start.h });
    const [first, second] = hueArc(start.h, end.h, method);

    return (t) => {
      const mixed: HueColor<string> = {
        ...start,
        h: lerp(first, second, t),
        a: lerp(start.a, end.a, t)
      };
      for (const channel of space.channels) {
        mixed[channel] = lerp(start[channel], end[channel], t);
      }

      return space.toRgb(mixed);
    };
  }

  static #encode(
    color: RGBA,
    encode: (channel: number) => number
  ): RGBA {
    return {
      r: encode(color.r),
      g: encode(color.g),
      b: encode(color.b),
      a: clampUnit(color.a)
    };
  }

  static #toLinear(
    channel: number
  ): number {
    return srgbToLinear(clampUnit(channel));
  }
}
