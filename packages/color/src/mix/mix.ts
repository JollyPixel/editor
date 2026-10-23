// Import Internal Dependencies
import {
  ColorSpace,
  type ColorSpaceName,
  type HueInterpolation
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

export function mixColor(
  from: RGBA,
  to: RGBA,
  amount: number,
  options: MixOptions = {}
): RGBA {
  const { space = "oklab", hue = "shorter" } = options;
  const t = clampUnit(amount);
  const a = lerp(clampUnit(from.a), clampUnit(to.a), t);

  switch (space) {
    case "srgb":
      return {
        r: lerp(clampUnit(from.r), clampUnit(to.r), t),
        g: lerp(clampUnit(from.g), clampUnit(to.g), t),
        b: lerp(clampUnit(from.b), clampUnit(to.b), t),
        a
      };
    case "linear":
      return {
        r: mixLinear(from.r, to.r, t),
        g: mixLinear(from.g, to.g, t),
        b: mixLinear(from.b, to.b, t),
        a
      };
    case "oklab": {
      const start = rgbToOklab(from);
      const end = rgbToOklab(to);

      return oklabToRgb(
        {
          l: lerp(start.l, end.l, t),
          a: lerp(start.a, end.a, t),
          b: lerp(start.b, end.b, t)
        },
        a
      );
    }
    default:
      return ColorSpace.named(space).mix(from, to, t, hue);
  }
}

export function colorRamp(
  from: RGBA,
  to: RGBA,
  count: number,
  options: MixOptions = {}
): RGBA[] {
  if (!Number.isInteger(count) || count < 2) {
    throw new RangeError("A color ramp needs an integer count of at least 2");
  }

  return Array.from(
    { length: count },
    (_, index) => mixColor(from, to, index / (count - 1), options)
  );
}

function mixLinear(
  from: number,
  to: number,
  t: number
): number {
  return linearToSrgb(lerp(
    srgbToLinear(clampUnit(from)),
    srgbToLinear(clampUnit(to)),
    t
  ));
}
