// Import Internal Dependencies
import { Color } from "../../Color.ts";
import { BYTE_MAX } from "../../math.ts";
import { parseHex } from "../../parse/hex.ts";
import { PaletteParseError } from "../errors/PaletteParseError.ts";
import type { PaletteFile } from "../PaletteFile.ts";
import type { PaletteContent } from "../PaletteFormat.ts";
import type { RGBA8 } from "../../types.ts";

// CONSTANTS
const kHexLine = /^#?(?:[\da-f]{6}|[\da-f]{8})$/i;

export function parseHexLines(
  lines: readonly string[]
): PaletteContent {
  const colors: RGBA8[] = [];
  for (const [index, raw] of lines.entries()) {
    const line = raw.trim();
    if (line === "") {
      continue;
    }
    const color = kHexLine.test(line) ? parseHex(line) : null;
    if (color === null) {
      throw new PaletteParseError("Invalid hex color", index + 1);
    }
    colors.push(new Color(color).toBytes());
  }

  return {
    colors,
    name: null
  };
}

export function serializeHexLines(
  file: PaletteFile
): string {
  return file.colors
    .map((color) => Color.fromBytes(color).hex(color.a !== BYTE_MAX).slice(1))
    .join("\n") + "\n";
}
