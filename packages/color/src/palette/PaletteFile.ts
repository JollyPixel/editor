// Import Internal Dependencies
import {
  isRGBA8,
  toRGBA8
} from "../convert/bytes.ts";
import { formatHex8 } from "../format.ts";
import { BYTE_MAX } from "../math.ts";
import { parseHex } from "../parse/hex.ts";
import { PaletteParseError } from "./errors/PaletteParseError.ts";
import type { RGBA8 } from "../types.ts";

// CONSTANTS
const kGplHeader = "GIMP Palette";
const kGplName = "Name:";
const kGplColumns = "Columns:";
const kGplChannels = "Channels:";
const kRgbaChannels = "RGBA";
const kByte = /^\d{1,3}$/;
const kHexLine = /^#?(?:[\da-f]{6}|[\da-f]{8})$/i;
const kLineBreak = /\r?\n/;
const kSpaces = /\s+/;
const kByteWidth = 3;

export type PaletteFormat = "gpl" | "hex";

export class PaletteFile {
  static parse(
    text: string,
    format: PaletteFormat
  ): PaletteFile {
    const lines = text.replace(/^﻿/, "").split(kLineBreak);

    return format === "gpl" ?
      PaletteFile.#parseGpl(lines) :
      PaletteFile.#parseHex(lines);
  }

  static #parseGpl(
    lines: readonly string[]
  ): PaletteFile {
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

    return PaletteFile.#parsed(colors, name);
  }

  static #parseHex(
    lines: readonly string[]
  ): PaletteFile {
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
      colors.push(toRGBA8(color));
    }

    return PaletteFile.#parsed(colors, null);
  }

  static #parsed(
    colors: RGBA8[],
    name: string | null
  ): PaletteFile {
    if (colors.length === 0) {
      throw new PaletteParseError("The palette has no colors");
    }

    return new PaletteFile(colors, name);
  }

  readonly colors: readonly RGBA8[];
  readonly name: string | null;

  constructor(
    colors: readonly RGBA8[],
    name: string | null = null
  ) {
    if (colors.length === 0) {
      throw new RangeError("A palette file needs at least one color");
    }
    if (!colors.every(isRGBA8)) {
      throw new TypeError("Palette channels must be integer bytes");
    }

    this.colors = Object.freeze(colors.map((color) => {
      return {
        r: color.r,
        g: color.g,
        b: color.b,
        a: color.a
      };
    }));
    this.name = name;
  }

  serialize(
    format: PaletteFormat
  ): string {
    if (format === "hex") {
      return this.colors
        .map((color) => formatHex8(color, color.a !== BYTE_MAX).slice(1))
        .join("\n") + "\n";
    }

    const alpha = this.colors.some((color) => color.a !== BYTE_MAX);
    const header = [kGplHeader];
    if (this.name !== null) {
      header.push(`${kGplName} ${this.name}`);
    }
    if (alpha) {
      header.push(`${kGplChannels} ${kRgbaChannels}`);
    }
    header.push("#");
    const rows = this.colors.map((color) => {
      const channels = alpha ?
        [color.r, color.g, color.b, color.a] :
        [color.r, color.g, color.b];
      const bytes = channels
        .map((channel) => String(channel).padStart(kByteWidth, " "))
        .join(" ");

      return `${bytes}\t${formatHex8(color, alpha).slice(1)}`;
    });

    return [...header, ...rows].join("\n") + "\n";
  }
}
