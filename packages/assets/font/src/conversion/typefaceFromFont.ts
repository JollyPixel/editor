/*
 * Ported from three.js examples/jsm/loaders/TTFLoader.js
 * Copyright (c) 2010-2026 three.js authors. MIT License.
 */

// Import Third-party Dependencies
import { InvalidAssetFileError } from "@jolly-pixel/asset-server";
import type {
  Font,
  Glyph,
  PathCommand
} from "opentype.js";

// Import Internal Dependencies
import { FONT_KIND } from "../asset/font.ts";
import {
  encodeTypeface,
  type Typeface
} from "../typeface/typeface.ts";

// CONSTANTS
const kResolution = 1000;
const kDefaultUnitsPerEm = 2048;

export async function typefaceContentFromFont(
  content: Uint8Array
): Promise<Uint8Array> {
  const { default: opentype } = await import("opentype.js");

  let font: Font;
  try {
    font = opentype.parse(content);
  }
  catch (error) {
    throw new InvalidAssetFileError(
      FONT_KIND,
      "content is not a TrueType, OpenType or WOFF font",
      { cause: error }
    );
  }

  return encodeTypeface(
    typefaceFromFont(font)
  );
}

function typefaceFromFont(
  font: Font
): Typeface {
  const scale = 100_000 / ((font.unitsPerEm || kDefaultUnitsPerEm) * 72);
  const glyphs: Typeface["glyphs"] = {};
  for (const index of Object.values(font.encoding.cmap.glyphIndexMap)) {
    const glyph = font.glyphs.get(index);
    const token = {
      ha: Math.round(glyph.advanceWidth * scale),
      x_min: Math.round((glyph.xMin ?? 0) * scale),
      x_max: Math.round((glyph.xMax ?? 0) * scale),
      o: outline(glyph.path.commands, scale)
    };
    for (const unicode of glyphUnicodes(glyph)) {
      glyphs[String.fromCodePoint(unicode)] = token;
    }
  }

  const { head, post } = font.tables;

  return {
    glyphs,
    familyName: font.getEnglishName("fullName"),
    ascender: Math.round(font.ascender * scale),
    descender: Math.round(font.descender * scale),
    underlinePosition: post.underlinePosition,
    underlineThickness: post.underlineThickness,
    boundingBox: {
      xMin: head.xMin,
      xMax: head.xMax,
      yMin: head.yMin,
      yMax: head.yMax
    },
    resolution: kResolution
  };
}

function glyphUnicodes(
  glyph: Glyph
): readonly number[] {
  if (glyph.unicodes.length > 0) {
    return glyph.unicodes;
  }

  return glyph.unicode === undefined ? [] : [glyph.unicode];
}

function outline(
  commands: readonly PathCommand[],
  scale: number
): string {
  const tokens: string[] = [];
  for (const command of commands) {
    const type = command.type.toLowerCase();
    tokens.push(type === "c" ? "b" : type);
    for (const [x, y] of [
      [command.x, command.y],
      [command.x1, command.y1],
      [command.x2, command.y2]
    ]) {
      if (x !== undefined && y !== undefined) {
        tokens.push(
          String(Math.round(x * scale)),
          String(Math.round(y * scale))
        );
      }
    }
  }

  return tokens.join(" ");
}
