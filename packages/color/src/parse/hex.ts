// Import Internal Dependencies
import { BYTE_MAX } from "../utils.ts";
import type { RGBA } from "../types.ts";

// CONSTANTS
const kHexPattern = /^#?([0-9a-f]+)$/i;
const kFullLengths = new Set([6, 8]);

/**
 * Accepts short or full hex, with an optional hash and alpha.
 */
export function parseHex(
  input: string
): RGBA | null {
  const match = kHexPattern.exec(input.trim());
  if (match === null) {
    return null;
  }

  const digits = match[1].toLowerCase();
  const hex = digits.length <= 4 ?
    expandShorthand(digits) :
    digits;

  if (!kFullLengths.has(hex.length)) {
    return null;
  }

  return {
    r: channel(hex, 0),
    g: channel(hex, 2),
    b: channel(hex, 4),
    a: hex.length === 8 ? channel(hex, 6) : 1
  };
}

function expandShorthand(
  digits: string
): string {
  return Array.from(
    digits,
    (digit) => digit + digit
  ).join("");
}

function channel(
  hex: string,
  index: number
): number {
  return Number.parseInt(
    hex.slice(index, index + 2),
    16
  ) / BYTE_MAX;
}
