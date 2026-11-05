// Import Internal Dependencies
import {
  oklchToRgb,
  rgbToOklch
} from "../convert/oklab/oklch.ts";
import { hueDelta } from "../hue.ts";
import { lerp } from "../math.ts";
import type {
  OKLCHA,
  RGBA
} from "../types.ts";

// CONSTANTS
const kCoolHue = 265;
const kWarmHue = 85;
const kChromaFalloff = 0.4;

export interface ShadeRampOptions {
  /**
   * Darker colors before the base color.
   * @default 3
   */
  shades?: number;
  /**
   * Lighter colors after the base color.
   * @default 3
   */
  tints?: number;
  /**
   * Hue rotation in degrees reached by the darkest and lightest colors.
   * @default 20
   */
  hueShift?: number;
}

export function shadeRamp(
  color: RGBA,
  options: ShadeRampOptions = {}
): RGBA[] {
  const {
    shades = 3,
    tints = 3,
    hueShift = 20
  } = options;
  assertCount(shades);
  assertCount(tints);

  const base = rgbToOklch(color);
  const ramp: RGBA[] = [];
  for (let step = shades; step > 0; step--) {
    ramp.push(shiftColor(base, {
      lightness: 0,
      hue: kCoolHue,
      t: step / (shades + 1),
      turn: (step / shades) * hueShift
    }));
  }
  ramp.push(oklchToRgb(base));
  for (let step = 1; step <= tints; step++) {
    ramp.push(shiftColor(base, {
      lightness: 1,
      hue: kWarmHue,
      t: step / (tints + 1),
      turn: (step / tints) * hueShift
    }));
  }

  return ramp;
}

interface ShadeStep {
  lightness: number;
  hue: number;
  t: number;
  turn: number;
}

function shiftColor(
  base: OKLCHA,
  step: ShadeStep
): RGBA {
  const delta = hueDelta(base.h, step.hue);
  const turn = Math.sign(delta) * Math.min(Math.abs(delta), Math.abs(step.turn));

  return oklchToRgb({
    l: lerp(base.l, step.lightness, step.t),
    c: base.c * (1 - (step.t * kChromaFalloff)),
    h: base.h + turn,
    a: base.a
  });
}

function assertCount(
  count: number
): void {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError("Shade and tint counts must be non-negative integers");
  }
}
