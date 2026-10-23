// Import Internal Dependencies
import {
  linearToSrgb,
  srgbToLinear
} from "../srgb.ts";
import {
  clampUnit,
  cube,
  wrapHue
} from "../../math.ts";
import type { RGBA } from "../../types.ts";

// CONSTANTS
const kRadians = Math.PI / 180;
const kAchromatic = 4e-6;

export interface Lab {
  l: number;
  a: number;
  b: number;
}

export interface LabPolar {
  c: number;
  h: number;
}

export interface HueDirection {
  a: number;
  b: number;
}

export interface LinearRgb {
  r: number;
  g: number;
  b: number;
}

export function linearRgbToOklab(
  color: LinearRgb
): Lab {
  const l = Math.cbrt(
    (0.4122214708 * color.r) +
    (0.5363325363 * color.g) +
    (0.0514459929 * color.b)
  );
  const m = Math.cbrt(
    (0.2119034982 * color.r) +
    (0.6806995451 * color.g) +
    (0.1073969566 * color.b)
  );
  const s = Math.cbrt(
    (0.0883024619 * color.r) +
    (0.2817188376 * color.g) +
    (0.6299787005 * color.b)
  );

  return {
    l: (0.2104542553 * l) + (0.7936177850 * m) - (0.0040720468 * s),
    a: (1.9779984951 * l) - (2.4285922050 * m) + (0.4505937099 * s),
    b: (0.0259040371 * l) + (0.7827717662 * m) - (0.8086757660 * s)
  };
}

export function oklabToLinearRgb(
  lab: Lab
): LinearRgb {
  const l = cube(lab.l + (0.3963377774 * lab.a) + (0.2158037573 * lab.b));
  const m = cube(lab.l - (0.1055613458 * lab.a) - (0.0638541728 * lab.b));
  const s = cube(lab.l - (0.0894841775 * lab.a) - (1.2914855480 * lab.b));

  return {
    r: (4.0767416621 * l) - (3.3077115913 * m) + (0.2309699292 * s),
    g: (-1.2684380046 * l) + (2.6097574011 * m) - (0.3413193965 * s),
    b: (-0.0041960863 * l) - (0.7034186147 * m) + (1.7076147010 * s)
  };
}

export function rgbToOklab(
  color: RGBA
): Lab {
  return linearRgbToOklab({
    r: srgbToLinear(clampUnit(color.r)),
    g: srgbToLinear(clampUnit(color.g)),
    b: srgbToLinear(clampUnit(color.b))
  });
}

export function linearRgbToRgb(
  color: LinearRgb,
  alpha: number
): RGBA {
  return {
    r: clampUnit(linearToSrgb(Math.max(color.r, 0))),
    g: clampUnit(linearToSrgb(Math.max(color.g, 0))),
    b: clampUnit(linearToSrgb(Math.max(color.b, 0))),
    a: clampUnit(alpha)
  };
}

export function oklabToRgb(
  lab: Lab,
  alpha: number
): RGBA {
  return linearRgbToRgb(oklabToLinearRgb(lab), alpha);
}

export function oklabDistance(
  first: Lab,
  second: Lab
): number {
  return Math.hypot(
    first.l - second.l,
    first.a - second.a,
    first.b - second.b
  );
}

export function oklabPolar(
  lab: Lab
): LabPolar {
  const chroma = Math.hypot(lab.a, lab.b);
  if (chroma < kAchromatic) {
    return {
      c: 0,
      h: 0
    };
  }

  return {
    c: chroma,
    h: wrapHue(Math.atan2(lab.b, lab.a) / kRadians)
  };
}

export function hueDirection(
  hue: number
): HueDirection {
  const angle = wrapHue(hue) * kRadians;

  return {
    a: Math.cos(angle),
    b: Math.sin(angle)
  };
}
