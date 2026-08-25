// Import Internal Dependencies
import type { ColorFunction } from "./arguments.ts";
import {
  parseAlpha,
  parseHue,
  parseUnitChannel
} from "./tokens.ts";
import { hslToRgb } from "../convert/hsl.ts";
import { hsvToRgb } from "../convert/hsv.ts";
import { hwbToRgb } from "../convert/hwb.ts";
import type { RGBA } from "../types.ts";

interface CylindricalChannels {
  h: number;
  x: number;
  y: number;
  a: number;
}

export function parseHslFunction(
  fn: ColorFunction
): RGBA | null {
  const channels = parseChannels(fn);

  return channels === null ? null : hslToRgb({
    h: channels.h,
    s: channels.x,
    l: channels.y,
    a: channels.a
  });
}

/**
 * Parses the editors' non-standard `hsv()` and `hsva()` syntax.
 */
export function parseHsvFunction(
  fn: ColorFunction
): RGBA | null {
  const channels = parseChannels(fn);

  return channels === null ? null : hsvToRgb({
    h: channels.h,
    s: channels.x,
    v: channels.y,
    a: channels.a
  });
}

/**
 * Rejects legacy comma syntax, which CSS does not define for `hwb()`.
 */
export function parseHwbFunction(
  fn: ColorFunction
): RGBA | null {
  if (fn.legacy) {
    return null;
  }

  const channels = parseChannels(fn);

  return channels === null ? null : hwbToRgb({
    h: channels.h,
    w: channels.x,
    b: channels.y,
    a: channels.a
  });
}

/**
 * Accepts CSS angle units and percentage-valued bare channels.
 */
function parseChannels(
  fn: ColorFunction
): CylindricalChannels | null {
  const [
    hue,
    first,
    second
  ] = fn.args;

  const h = parseHue(hue);
  const x = parseUnitChannel(first);
  const y = parseUnitChannel(second);
  const a = parseAlpha(fn.alpha);

  if (
    h === null ||
    x === null ||
    y === null ||
    a === null
  ) {
    return null;
  }

  return {
    h,
    x,
    y,
    a
  };
}
