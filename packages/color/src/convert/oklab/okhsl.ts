/*
 * Ported from ok_color.h, https://bottosson.github.io/posts/colorpicker/
 * Copyright (c) 2021 Björn Ottosson. MIT License.
 */

// Import Internal Dependencies
import {
  chromaStops,
  toe,
  toeInverse
} from "./cusp.ts";
import {
  hueDirection,
  oklabPolar,
  oklabToRgb,
  rgbToOklab
} from "./oklab.ts";
import { clampUnit } from "../../math.ts";
import type {
  OKHSLA,
  RGBA
} from "../../types.ts";

// CONSTANTS
const kMid = 0.8;
const kMidInverse = 1.25;

export function rgbToOkhsl(
  color: RGBA
): OKHSLA {
  const lab = rgbToOklab(color);
  const alpha = clampUnit(color.a);
  const { c: chroma, h } = oklabPolar(lab);
  const l = clampUnit(toe(Math.max(lab.l, 0)));
  if (chroma === 0 || l <= 0 || l >= 1) {
    return {
      h: 0,
      s: 0,
      l,
      a: alpha
    };
  }

  const { c0, cMid, cMax } = chromaStops(
    lab.l,
    lab.a / chroma,
    lab.b / chroma
  );
  let s: number;
  if (chroma < cMid) {
    const k1 = kMid * c0;
    const k2 = 1 - (k1 / cMid);
    s = (chroma / (k1 + (k2 * chroma))) * kMid;
  }
  else {
    const k1 = ((1 - kMid) * cMid * cMid * kMidInverse * kMidInverse) / c0;
    const k2 = 1 - (k1 / (cMax - cMid));
    const offset = chroma - cMid;
    s = kMid + ((1 - kMid) * (offset / (k1 + (k2 * offset))));
  }

  return {
    h,
    s: clampUnit(s),
    l,
    a: alpha
  };
}

export function okhslToRgb(
  color: OKHSLA
): RGBA {
  const s = clampUnit(color.s);
  const l = clampUnit(color.l);
  if (l >= 1 || l <= 0) {
    return oklabToRgb({ l, a: 0, b: 0 }, color.a);
  }

  const { a, b } = hueDirection(color.h);
  const lightness = toeInverse(l);
  const { c0, cMid, cMax } = chromaStops(lightness, a, b);
  let chroma: number;
  if (s < kMid) {
    const t = kMidInverse * s;
    const k1 = kMid * c0;
    const k2 = 1 - (k1 / cMid);
    chroma = (t * k1) / (1 - (k2 * t));
  }
  else {
    const t = (s - kMid) / (1 - kMid);
    const k1 = ((1 - kMid) * cMid * cMid * kMidInverse * kMidInverse) / c0;
    const k2 = 1 - (k1 / (cMax - cMid));
    chroma = cMid + ((t * k1) / (1 - (k2 * t)));
  }

  return oklabToRgb(
    {
      l: lightness,
      a: chroma * a,
      b: chroma * b
    },
    color.a
  );
}
