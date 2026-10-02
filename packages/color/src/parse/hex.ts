// Import Internal Dependencies
import { BYTE_MAX } from "../utils.ts";
import type { RGBA } from "../types.ts";

// CONSTANTS
const kHash = 0x23;
const kAsciiBits = 7;
const kMaxDigits = 8;
const kHexDigits = "0123456789abcdef";
const kNibbles = nibbleTable();

/**
 * Accepts short or full hex, with an optional hash and alpha.
 */
export function parseHex(
  input: string
): RGBA | null {
  const value = input.trim();
  const start = value.charCodeAt(0) === kHash ? 1 : 0;
  const digits = value.length - start;
  if (digits > kMaxDigits) {
    return null;
  }

  let packed = 0;
  let invalid = 0;
  for (let i = start; i < value.length; i++) {
    const nibble = nibbleOf(value.charCodeAt(i));
    invalid |= nibble;
    packed = (packed << 4) | nibble;
  }

  if (invalid < 0) {
    return null;
  }

  switch (digits) {
    case 3:
      return unpack(expandShorthand((packed << 4) | 0xf));
    case 4:
      return unpack(expandShorthand(packed));
    case 6:
      return unpack((packed << 8) | 0xff);
    case 8:
      return unpack(packed);
    default:
      return null;
  }
}

function nibbleOf(
  code: number
): number {
  return kNibbles[code & 0x7f] | -(code >> kAsciiBits);
}

function expandShorthand(
  packed: number
): number {
  const bytes = (packed | (packed << 8)) & 0x00ff00ff;
  const nibbles = (bytes | (bytes << 4)) & 0x0f0f0f0f;

  return nibbles * 0x11;
}

function unpack(
  rgba: number
): RGBA {
  return {
    r: (rgba >>> 24) / BYTE_MAX,
    g: ((rgba >>> 16) & 0xff) / BYTE_MAX,
    b: ((rgba >>> 8) & 0xff) / BYTE_MAX,
    a: (rgba & 0xff) / BYTE_MAX
  };
}

function nibbleTable(): Int8Array {
  const table = new Int8Array(1 << kAsciiBits).fill(-1);
  for (let i = 0; i < kHexDigits.length; i++) {
    table[kHexDigits.charCodeAt(i)] = i;
    table[kHexDigits.toUpperCase().charCodeAt(i)] = i;
  }

  return table;
}
