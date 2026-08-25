// Import Internal Dependencies
import { BYTE_MAX } from "../../src/utils.ts";
import type { RGBA } from "../../src/types.ts";

/**
 * Builds the expected unit sRGB color from the 0-255 channels a fixture is
 * easier to read in. Alpha stays 0-1, as it is in every notation.
 */
export function unit(
  r: number,
  g: number,
  b: number,
  a = 1
): RGBA {
  return {
    r: r / BYTE_MAX,
    g: g / BYTE_MAX,
    b: b / BYTE_MAX,
    a
  };
}
