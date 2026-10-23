// Import Third-party Dependencies
import type {
  HSVA,
  RGBA
} from "@jolly-pixel/color";

// Import Internal Dependencies
import { clamp } from "../numeric/bounds.ts";
import type { NumericBounds } from "../numeric/entry.ts";
import { ChannelModel } from "./ChannelModel.ts";
import type { PickerSpace } from "./space.ts";

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
  okl: {
    step: 1,
    min: 0,
    max: 100
  },
  okc: {
    step: 0.001,
    min: 0,
    max: 0.4
  },
  okh: {
    step: 1,
    min: 0,
    max: 360
  },
  a: {
    step: 1,
    min: 0,
    max: 100
  }
};
export const CHANNEL_ROWS: Readonly<
  Record<ColorPickerChannels, ReadonlyArray<[ColorChannel, ColorChannel]>>
> = {
  hsl: [
    ["r", "h"],
    ["g", "s"],
    ["b", "l"]
  ],
  oklch: [
    ["r", "okl"],
    ["g", "okc"],
    ["b", "okh"]
  ]
};
const kByte = 255;
const kPercent = 100;

export type ColorPickerChannels = "hsl" | "oklch";

export type ColorChannel =
  | "r"
  | "g"
  | "b"
  | "h"
  | "s"
  | "l"
  | "okl"
  | "okc"
  | "okh"
  | "a";

export type ChannelValues = Record<ColorChannel, number>;

export function channelValues(
  point: HSVA,
  space: PickerSpace
): ChannelValues {
  const rgb = space.toRgb(point);

  return {
    r: Math.round(rgb.r * kByte),
    g: Math.round(rgb.g * kByte),
    b: Math.round(rgb.b * kByte),
    ...ChannelModel.hsl.read(point, space),
    ...ChannelModel.oklch.read(point, space),
    a: Math.round(point.a * kPercent)
  };
}

export function applyChannel(
  point: HSVA,
  channel: ColorChannel,
  value: number,
  space: PickerSpace
): HSVA {
  const { min, max } = CHANNEL_BOUNDS[channel];
  const bounded = clamp(value, min, max);

  switch (channel) {
    case "r":
    case "g":
    case "b":
      return applyRgbChannel(point, channel, bounded, space);
    case "h":
    case "s":
    case "l":
      return ChannelModel.hsl.write(point, channel, bounded, space);
    case "okl":
    case "okc":
    case "okh":
      return ChannelModel.oklch.write(point, channel, bounded, space);
    default:
      return {
        ...point,
        a: bounded / kPercent
      };
  }
}

function applyRgbChannel(
  point: HSVA,
  channel: "r" | "g" | "b",
  value: number,
  space: PickerSpace
): HSVA {
  const rgb = space.toRgb(point);
  const next: RGBA = {
    r: Math.round(rgb.r * kByte) / kByte,
    g: Math.round(rgb.g * kByte) / kByte,
    b: Math.round(rgb.b * kByte) / kByte,
    a: point.a,
    [channel]: value / kByte
  };

  return space.fromRgb(next, point);
}
