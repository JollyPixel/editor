/*
 * Ported from ok_color.h, https://bottosson.github.io/posts/colorpicker/
 * Copyright (c) 2021 Björn Ottosson. MIT License.
 */

// Import Internal Dependencies
import {
  cuspSlopes,
  findCusp,
  toe,
  toeInverse
} from "./cusp.ts";
import {
  hueDirection,
  oklabPolar,
  oklabToLinearRgb,
  oklabToRgb,
  rgbToOklab
} from "./oklab.ts";
import { clampUnit } from "../../math.ts";
import type {
  OKHSVA,
  RGBA
} from "../../types.ts";

// CONSTANTS
const kSaturationZero = 0.5;

export function rgbToOkhsv(
  color: RGBA
): OKHSVA {
  const lab = rgbToOklab(color);
  const alpha = clampUnit(color.a);
  const { c: chroma, h } = oklabPolar(lab);
  if (chroma === 0 || lab.l <= 0) {
    return {
      h: 0,
      s: 0,
      v: clampUnit(toe(Math.max(lab.l, 0))),
      a: alpha
    };
  }

  const a = lab.a / chroma;
  const b = lab.b / chroma;
  const [sMax, tMax] = cuspSlopes(findCusp(a, b));
  const k = 1 - (kSaturationZero / sMax);
  const t = tMax / (chroma + (lab.l * tMax));
  const lv = t * lab.l;
  const cv = t * chroma;
  const lvt = toeInverse(lv);
  const cvt = (cv * lvt) / lv;
  const scale = scaleAt(lvt, cvt, a, b);
  const lScaled = lab.l / scale;
  const lToe = toe(lScaled);

  return {
    h,
    s: clampUnit(
      ((kSaturationZero + tMax) * cv) /
      ((tMax * kSaturationZero) + (tMax * k * cv))
    ),
    v: clampUnit(lToe / lv),
    a: alpha
  };
}

export function okhsvToRgb(
  color: OKHSVA
): RGBA {
  const s = clampUnit(color.s);
  const v = clampUnit(color.v);
  if (v === 0) {
    return oklabToRgb({ l: 0, a: 0, b: 0 }, color.a);
  }

  const { a, b } = hueDirection(color.h);
  const [sMax, tMax] = cuspSlopes(findCusp(a, b));
  const k = 1 - (kSaturationZero / sMax);
  const divisor = kSaturationZero + tMax - (tMax * k * s);
  const lv = 1 - ((s * kSaturationZero) / divisor);
  const cv = (s * tMax * kSaturationZero) / divisor;
  const lvt = toeInverse(lv);
  const cvt = (cv * lvt) / lv;
  const lLinear = v * lv;
  const lToe = toeInverse(lLinear);
  const scale = scaleAt(lvt, cvt, a, b);
  const l = lToe * scale;
  const c = ((v * cv * lToe) / lLinear) * scale;

  return oklabToRgb(
    {
      l,
      a: c * a,
      b: c * b
    },
    color.a
  );
}

function scaleAt(
  l: number,
  c: number,
  a: number,
  b: number
): number {
  const rgb = oklabToLinearRgb({
    l,
    a: a * c,
    b: b * c
  });

  return Math.cbrt(1 / Math.max(rgb.r, rgb.g, rgb.b, 0));
}
