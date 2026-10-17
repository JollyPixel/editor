// Import Internal Dependencies
import { BYTE_MAX } from "../../src/utils.ts";
import type { RGBA } from "../../src/types.ts";

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
