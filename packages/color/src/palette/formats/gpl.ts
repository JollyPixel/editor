// Import Internal Dependencies
import { Color } from "../../Color.ts";
import { BYTE_MAX } from "../../math.ts";
import { PaletteParseError } from "../errors/PaletteParseError.ts";
import type { PaletteFile } from "../PaletteFile.ts";
import type { PaletteContent } from "../PaletteFormat.ts";
import type { RGBA8 } from "../../types.ts";

// CONSTANTS
const kGplHeader = "GIMP Palette";
const kGplName = "Name:";
const kGplColumns = "Columns:";
const kGplChannels = "Channels:";
const kRgbaChannels = "RGBA";
const kByte = /^\d{1,3}$/;
const kSpaces = /\s+/;
const kByteWidth = 3;

export function parseGpl(
  lines: readonly string[]
): PaletteContent {
  const start = lines.findIndex((line) => line.trim() !== "");
  if (start === -1 || lines[start].trim() !== kGplHeader) {
    throw new PaletteParseError("Missing 'GIMP Palette' header", 1);
  }

  const colors: RGBA8[] = [];
  let name: string | null = null;
  let alpha = false;
  for (let index = start + 1; index < lines.length; index++) {
    const line = lines[index].trim();
    if (line === "" || line.startsWith("#") || line.startsWith(kGplColumns)) {
      continue;
    }
    if (line.startsWith(kGplName)) {
      name = line.slice(kGplName.length).trim() || null;
      continue;
    }
    if (line.startsWith(kGplChannels)) {
      alpha = line.slice(kGplChannels.length).trim() === kRgbaChannels;
      continue;
    }

    const tokens = line.split(kSpaces);
    const channels = tokens.slice(0, alpha ? 4 : 3);
    if (
      channels.length < (alpha ? 4 : 3) ||
      !channels.every((token) => kByte.test(token) && Number(token) <= BYTE_MAX)
    ) {
      throw new PaletteParseError("Invalid color row", index + 1);
    }
    const [r, g, b, a = BYTE_MAX] = channels.map(Number);
    colors.push({ r, g, b, a });
  }

  return {
    colors,
    name
  };
}

export function serializeGpl(
  file: PaletteFile
): string {
  const alpha = file.colors.some((color) => color.a !== BYTE_MAX);
  const header = [kGplHeader];
  if (file.name !== null) {
    header.push(`${kGplName} ${file.name}`);
  }
  if (alpha) {
    header.push(`${kGplChannels} ${kRgbaChannels}`);
  }
  header.push("#");
  const rows = file.colors.map((color) => {
    const channels = alpha ?
      [color.r, color.g, color.b, color.a] :
      [color.r, color.g, color.b];
    const bytes = channels
      .map((channel) => String(channel).padStart(kByteWidth, " "))
      .join(" ");

    return `${bytes}\t${Color.fromBytes(color).hex(alpha).slice(1)}`;
  });

  return [...header, ...rows].join("\n") + "\n";
}
