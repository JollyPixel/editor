// Import Internal Dependencies
import {
  parseFunction,
  type ColorFunction
} from "./arguments.ts";
import {
  parseHslFunction,
  parseHsvFunction,
  parseHwbFunction
} from "./cylindrical.ts";
import { parseHex } from "./hex.ts";
import { parseNamed } from "./named.ts";
import {
  parseOklabFunction,
  parseOklchFunction
} from "./oklab.ts";
import { parseRgbFunction } from "./rgb.ts";
import { ColorParseError } from "./errors/ColorParseError.ts";
import { toRGBA8 } from "../convert/bytes.ts";
import type {
  ColorInput,
  ColorInput8,
  RGBA,
  RGBA8
} from "../types.ts";

// CONSTANTS
const kHash = 0x23;
const kCloseParen = 0x29;

export function parseColor(
  input: string
): RGBA | null {
  const value = input.trim();
  if (value === "") {
    return null;
  }
  if (value.charCodeAt(0) === kHash) {
    return parseHex(value);
  }

  const named = parseNamed(value);
  if (named !== null) {
    return named;
  }
  if (value.charCodeAt(value.length - 1) === kCloseParen) {
    const fn = parseFunction(value);

    return fn === null ? null : fromFunction(fn);
  }

  return parseHex(value);
}

export function assertColor(
  input: ColorInput
): RGBA {
  if (typeof input !== "string") {
    return input;
  }

  const parsed = parseColor(input);
  if (parsed === null) {
    throw new ColorParseError(input);
  }

  return parsed;
}

export function assertColor8(
  input: ColorInput8
): RGBA8 {
  if (typeof input !== "string") {
    return input;
  }

  return toRGBA8(assertColor(input));
}

function fromFunction(
  fn: ColorFunction
): RGBA | null {
  switch (fn.name) {
    case "rgb":
    case "rgba":
      return parseRgbFunction(fn);
    case "hsl":
    case "hsla":
      return parseHslFunction(fn);
    case "hsv":
    case "hsva":
      return parseHsvFunction(fn);
    case "hwb":
      return parseHwbFunction(fn);
    case "oklch":
      return parseOklchFunction(fn);
    case "oklab":
      return parseOklabFunction(fn);
    default:
      return null;
  }
}
