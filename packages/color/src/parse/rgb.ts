// Import Internal Dependencies
import type { ColorFunction } from "./arguments.ts";
import {
  parseAlpha,
  parseUnitFromByte
} from "./tokens.ts";
import type { RGBA } from "../types.ts";

/**
 * Accepts both syntaxes and clamps numeric or percentage channels.
 */
export function parseRgbFunction(
  fn: ColorFunction
): RGBA | null {
  const [
    r,
    g,
    b
  ] = fn.args.map(parseUnitFromByte);
  const a = parseAlpha(fn.alpha);

  if (
    r === null ||
    g === null ||
    b === null ||
    a === null
  ) {
    return null;
  }

  return {
    r,
    g,
    b,
    a
  };
}
