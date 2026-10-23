/*
 * Ported from ok_color.h, https://bottosson.github.io/posts/colorpicker/
 * Copyright (c) 2021 Björn Ottosson. MIT License.
 */

// Import Internal Dependencies
import { oklabToLinearRgb } from "./oklab.ts";
import { cube } from "../../math.ts";

// CONSTANTS
const kToeK1 = 0.206;
const kToeK2 = 0.03;
const kToeK3 = (1 + kToeK1) / (1 + kToeK2);
const kRed = [4.0767416621, -3.3077115913, 0.2309699292] as const;
const kGreen = [-1.2684380046, 2.6097574011, -0.3413193965] as const;
const kBlue = [-0.0041960863, -0.7034186147, 1.7076147010] as const;

export interface Cusp {
  l: number;
  c: number;
}

export interface ChromaStops {
  c0: number;
  cMid: number;
  cMax: number;
}

type ChannelWeights = readonly [number, number, number];

interface ChannelInputs {
  value: ChannelWeights;
  first: ChannelWeights;
  second: ChannelWeights;
}

interface LmsSlope {
  l: number;
  m: number;
  s: number;
}

export function toe(
  x: number
): number {
  const scaled = (kToeK3 * x) - kToeK1;

  return 0.5 * (
    scaled + Math.sqrt((scaled * scaled) + (4 * kToeK2 * kToeK3 * x))
  );
}

export function toeInverse(
  x: number
): number {
  return ((x * x) + (kToeK1 * x)) / (kToeK3 * (x + kToeK2));
}

export function findCusp(
  a: number,
  b: number
): Cusp {
  const saturation = maxSaturation(a, b);
  const rgb = oklabToLinearRgb({
    l: 1,
    a: saturation * a,
    b: saturation * b
  });
  const l = Math.cbrt(1 / Math.max(rgb.r, rgb.g, rgb.b));

  return {
    l,
    c: l * saturation
  };
}

export function cuspSlopes(
  cusp: Cusp
): [number, number] {
  return [
    cusp.c / cusp.l,
    cusp.c / (1 - cusp.l)
  ];
}

export function chromaStops(
  l: number,
  a: number,
  b: number
): ChromaStops {
  const cusp = findCusp(a, b);
  const cMax = maxChroma(
    l,
    a,
    b,
    cusp
  );
  const [sMax, tMax] = cuspSlopes(cusp);
  const scale = cMax / Math.min(l * sMax, (1 - l) * tMax);
  const [sMid, tMid] = midSlopes(a, b);
  const midA = l * sMid;
  const midB = (1 - l) * tMid;
  const zeroA = l * 0.4;
  const zeroB = (1 - l) * 0.8;

  return {
    c0: Math.sqrt(1 / ((1 / (zeroA * zeroA)) + (1 / (zeroB * zeroB)))),
    cMid: 0.9 * scale * Math.sqrt(Math.sqrt(
      1 / ((1 / (midA ** 4)) + (1 / (midB ** 4)))
    )),
    cMax
  };
}

function maxSaturation(
  a: number,
  b: number
): number {
  let coefficients: readonly number[];
  let weights: ChannelWeights;
  if ((-1.88170328 * a) - (0.80936493 * b) > 1) {
    coefficients = [1.19086277, 1.76576728, 0.59662641, 0.75515197, 0.56771245];
    weights = kRed;
  }
  else if ((1.81444104 * a) - (1.19445276 * b) > 1) {
    coefficients = [0.73956515, -0.45954404, 0.08285427, 0.12541070, 0.14503204];
    weights = kGreen;
  }
  else {
    coefficients = [1.35733652, -0.00915799, -1.15130210, -0.50559606, 0.00692167];
    weights = kBlue;
  }

  const [k0, k1, k2, k3, k4] = coefficients;
  const saturation = k0 + (k1 * a) + (k2 * b) + (k3 * a * a) + (k4 * a * b);
  const slope = lmsSlope(a, b);
  const l = 1 + (saturation * slope.l);
  const m = 1 + (saturation * slope.m);
  const s = 1 + (saturation * slope.s);
  const f = weigh(weights, cube(l), cube(m), cube(s));
  const f1 = weigh(
    weights,
    3 * slope.l * l * l,
    3 * slope.m * m * m,
    3 * slope.s * s * s
  );
  const f2 = weigh(
    weights,
    6 * slope.l * slope.l * l,
    6 * slope.m * slope.m * m,
    6 * slope.s * slope.s * s
  );

  return saturation - ((f * f1) / ((f1 * f1) - (0.5 * f * f2)));
}

function maxChroma(
  lightness: number,
  a: number,
  b: number,
  cusp: Cusp
): number {
  if (lightness <= cusp.l) {
    return (cusp.c * lightness) / cusp.l;
  }

  const t = (cusp.c * (lightness - 1)) / (cusp.l - 1);
  const slope = lmsSlope(a, b);
  const l = lightness + (t * slope.l);
  const m = lightness + (t * slope.m);
  const s = lightness + (t * slope.s);
  const values: ChannelInputs = {
    value: [cube(l), cube(m), cube(s)],
    first: [
      3 * slope.l * l * l,
      3 * slope.m * m * m,
      3 * slope.s * s * s
    ],
    second: [
      6 * slope.l * slope.l * l,
      6 * slope.m * slope.m * m,
      6 * slope.s * slope.s * s
    ]
  };

  return t + Math.min(
    newtonStep(kRed, values),
    newtonStep(kGreen, values),
    newtonStep(kBlue, values)
  );
}

function newtonStep(
  weights: ChannelWeights,
  inputs: ChannelInputs
): number {
  const f = weigh(weights, ...inputs.value) - 1;
  const f1 = weigh(weights, ...inputs.first);
  const f2 = weigh(weights, ...inputs.second);
  const u = f1 / ((f1 * f1) - (0.5 * f * f2));

  return u >= 0 ? -f * u : Number.MAX_VALUE;
}

function midSlopes(
  a: number,
  b: number
): [number, number] {
  const s = 0.11516993 + (1 / (
    7.44778970 + (4.15901240 * b) +
    (a * (-2.19557347 + (1.75198401 * b) +
      (a * (-2.13704948 - (10.02301043 * b) +
        (a * (-4.24894561 + (5.38770819 * b) + (4.69891013 * a)))))))
  ));
  const t = 0.11239642 + (1 / (
    1.61320320 - (0.68124379 * b) +
    (a * (0.40370612 + (0.90148123 * b) +
      (a * (-0.27087943 + (0.61223990 * b) +
        (a * (0.00299215 - (0.45399568 * b) - (0.14661872 * a)))))))
  ));

  return [s, t];
}

function lmsSlope(
  a: number,
  b: number
): LmsSlope {
  return {
    l: (0.3963377774 * a) + (0.2158037573 * b),
    m: (-0.1055613458 * a) - (0.0638541728 * b),
    s: (-0.0894841775 * a) - (1.2914855480 * b)
  };
}

function weigh(
  weights: ChannelWeights,
  l: number,
  m: number,
  s: number
): number {
  return (weights[0] * l) + (weights[1] * m) + (weights[2] * s);
}
