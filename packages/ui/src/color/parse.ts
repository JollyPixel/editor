// Import Internal Dependencies
import type { RGBA } from "./types.ts";

// CONSTANTS
const kHexPattern = /^#?([0-9a-f]+)$/i;
const kFullLengths = new Set([6, 8]);

/**
 * Parses `#rgb`, `#rrggbb`, or `#rrggbbaa` with an optional hash.
 * Returns `null` for other formats and partial input. Four-digit `#rgba` is
 * excluded because it is ambiguous with partially typed six-digit values.
 */
export function parseColor(
  input: string
): RGBA | null {
  const match = kHexPattern.exec(input.trim());
  if (match === null) {
    return null;
  }

  const digits = match[1].toLowerCase();
  const hex = digits.length === 3
    ? expandShorthand(digits)
    : digits;

  if (!kFullLengths.has(hex.length)) {
    return null;
  }

  return {
    r: channel(hex, 0),
    g: channel(hex, 2),
    b: channel(hex, 4),
    a: hex.length === 8 ? channel(hex, 6) / 255 : 1
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
  );
}
