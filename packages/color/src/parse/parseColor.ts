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
import { parseRgbFunction } from "./rgb.ts";
import type {
  ColorInput,
  RGBA
} from "../types.ts";

export class ColorParseError extends Error {
  constructor(
    input: string
  ) {
    super(`Unable to parse color '${input}'`);
    this.name = "ColorParseError";
  }
}

/**
 * Returns `null` for partial input so fields can parse every keystroke.
 */
export function parseColor(
  input: string
): RGBA | null {
  const value = input.trim();
  if (value === "") {
    return null;
  }

  const named = parseNamed(value);
  if (named !== null) {
    return named;
  }

  const fn = parseFunction(value);
  if (fn !== null) {
    return fromFunction(fn);
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
    default:
      return null;
  }
}
