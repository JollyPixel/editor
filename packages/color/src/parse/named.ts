// Import Internal Dependencies
import { kNamedColors } from "./names.ts";
import { BYTE_MAX } from "../utils.ts";
import type { RGBA } from "../types.ts";

// CONSTANTS
const kTransparent = "transparent";
const kNamePattern = /^[a-z]+$/i;

export function parseNamed(
  input: string
): RGBA | null {
  const name = input.trim().toLowerCase();
  if (!kNamePattern.test(name)) {
    return null;
  }

  if (name === kTransparent) {
    return {
      r: 0,
      g: 0,
      b: 0,
      a: 0
    };
  }

  const packed = kNamedColors[name];
  if (packed === undefined) {
    return null;
  }

  return {
    r: ((packed >> 16) & 0xff) / BYTE_MAX,
    g: ((packed >> 8) & 0xff) / BYTE_MAX,
    b: (packed & 0xff) / BYTE_MAX,
    a: 1
  };
}
