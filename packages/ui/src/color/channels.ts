// Import Third-party Dependencies
import {
  hslToHsv,
  hsvToHsl,
  hsvToRgb,
  rgbToHsv,
  type HSVA
} from "@jolly-pixel/color";

// Import Internal Dependencies
import { clamp } from "../numeric/bounds.ts";
import type { NumericBounds } from "../numeric/entry.ts";

// CONSTANTS
export const CHANNEL_BOUNDS: Readonly<Record<ColorChannel, NumericBounds>> = {
  r: {
    step: 1,
    min: 0,
    max: 255
  },
  g: {
    step: 1,
    min: 0,
    max: 255
  },
  b: {
    step: 1,
    min: 0,
    max: 255
  },
  h: {
    step: 1,
    min: 0,
    max: 360
  },
  s: {
    step: 1,
    min: 0,
    max: 100
  },
  l: {
    step: 1,
    min: 0,
    max: 100
  },
  a: {
    step: 1,
    min: 0,
    max: 100
  }
};
const kByte = 255;
const kPercent = 100;

export type ColorChannel =
  | "r"
  | "g"
  | "b"
  | "h"
  | "s"
  | "l"
  | "a";

export type ChannelValues = Record<ColorChannel, number>;

export function channelValues(
  hsva: HSVA
): ChannelValues {
  const rgb = hsvToRgb(hsva);
  const hsl = hsvToHsl(hsva);

  return {
    r: Math.round(rgb.r * kByte),
    g: Math.round(rgb.g * kByte),
    b: Math.round(rgb.b * kByte),
    h: Math.round(hsva.h),
    s: Math.round(hsl.s * kPercent),
    l: Math.round(hsl.l * kPercent),
    a: Math.round(hsva.a * kPercent)
  };
}

export function applyChannel(
  hsva: HSVA,
  channel: ColorChannel,
  value: number
): HSVA {
  const { min, max } = CHANNEL_BOUNDS[channel];
  const bounded = clamp(value, min, max);

  if (channel === "r" || channel === "g" || channel === "b") {
    return applyRgbChannel(hsva, channel, bounded);
  }
  if (channel === "s" || channel === "l") {
    return applyHslChannel(hsva, channel, bounded);
  }
  if (channel === "h") {
    return {
      ...hsva,
      h: bounded
    };
  }

  return {
    ...hsva,
    a: bounded / kPercent
  };
}

function applyRgbChannel(
  hsva: HSVA,
  channel: "r" | "g" | "b",
  value: number
): HSVA {
  const rgb = hsvToRgb(hsva);
  const next = {
    r: Math.round(rgb.r * kByte) / kByte,
    g: Math.round(rgb.g * kByte) / kByte,
    b: Math.round(rgb.b * kByte) / kByte,
    a: hsva.a,
    [channel]: value / kByte
  };
  const converted = rgbToHsv(next);

  return {
    h: converted.s === 0 || converted.v === 0 ? hsva.h : converted.h,
    s: converted.v === 0 ? hsva.s : converted.s,
    v: converted.v,
    a: hsva.a
  };
}

function applyHslChannel(
  hsva: HSVA,
  channel: "s" | "l",
  value: number
): HSVA {
  const hsv = hslToHsv({
    ...hsvToHsl(hsva),
    [channel]: value / kPercent
  });

  return {
    ...hsva,
    s: hsv.s,
    v: hsv.v
  };
}
