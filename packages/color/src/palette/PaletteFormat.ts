// Import Internal Dependencies
import {
  parseGpl,
  serializeGpl
} from "./formats/gpl.ts";
import {
  parseHexLines,
  serializeHexLines
} from "./formats/hex.ts";
import { PaletteFile } from "./PaletteFile.ts";
import { PaletteParseError } from "./errors/PaletteParseError.ts";
import type { RGBA8 } from "../types.ts";

// CONSTANTS
const kByteOrderMark = /^﻿/;
const kLineBreak = /\r?\n/;

export type PaletteExtension = "gpl" | "hex";

export interface PaletteContent {
  colors: RGBA8[];
  name: string | null;
}

export interface PaletteFormatInit {
  extension: PaletteExtension;
  parse: (lines: readonly string[]) => PaletteContent;
  serialize: (file: PaletteFile) => string;
}

export class PaletteFormat {
  static readonly gpl = new PaletteFormat({
    extension: "gpl",
    parse: parseGpl,
    serialize: serializeGpl
  });

  static readonly hex = new PaletteFormat({
    extension: "hex",
    parse: parseHexLines,
    serialize: serializeHexLines
  });

  static fromFileName(
    fileName: string
  ): PaletteFormat {
    return fileName.toLowerCase().endsWith(".hex") ?
      PaletteFormat.hex :
      PaletteFormat.gpl;
  }

  readonly extension: PaletteExtension;
  readonly #init: PaletteFormatInit;

  constructor(
    init: PaletteFormatInit
  ) {
    this.extension = init.extension;
    this.#init = init;
  }

  parse(
    text: string
  ): PaletteFile {
    const { colors, name } = this.#init.parse(
      text.replace(kByteOrderMark, "").split(kLineBreak)
    );
    if (colors.length === 0) {
      throw new PaletteParseError("The palette has no colors");
    }

    return new PaletteFile(colors, name);
  }

  serialize(
    file: PaletteFile
  ): string {
    return this.#init.serialize(file);
  }
}
