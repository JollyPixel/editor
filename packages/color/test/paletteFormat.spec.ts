// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PaletteFile } from "../src/palette/PaletteFile.ts";
import { PaletteFormat } from "../src/palette/PaletteFormat.ts";
import { PaletteParseError } from "../src/palette/errors/PaletteParseError.ts";
import type { RGBA8 } from "../src/types.ts";

// CONSTANTS
const kBlack: RGBA8 = { r: 0, g: 0, b: 0, a: 255 };
const kCoral: RGBA8 = { r: 255, g: 0, b: 77, a: 255 };
const kGlass: RGBA8 = { r: 41, g: 173, b: 255, a: 128 };

describe("PaletteFormat.gpl.parse", () => {
  test("reads the name and colors, skipping comments and columns", () => {
    const file = PaletteFormat.gpl.parse([
      "GIMP Palette",
      "Name: Sunset",
      "Columns: 4",
      "# a comment",
      "  0   0   0\tBlack",
      "255   0  77",
      ""
    ].join("\r\n"));

    assert.equal(file.name, "Sunset");
    assert.deepEqual(file.colors, [kBlack, kCoral]);
  });

  test("reads an alpha column after 'Channels: RGBA'", () => {
    const file = PaletteFormat.gpl.parse([
      "GIMP Palette",
      "Channels: RGBA",
      " 41 173 255 128 Glass"
    ].join("\n"));

    assert.deepEqual(file.colors, [kGlass]);
  });

  test("reports the line of a broken row", () => {
    assert.throws(
      () => PaletteFormat.gpl.parse("GIMP Palette\n0 0 0\n0 256 0\n"),
      (error: unknown) => error instanceof PaletteParseError && error.line === 3
    );
  });

  test("rejects a file without the header or without colors", () => {
    assert.throws(() => PaletteFormat.gpl.parse("0 0 0\n"), PaletteParseError);
    assert.throws(() => PaletteFormat.gpl.parse("GIMP Palette\n#\n"), PaletteParseError);
  });
});

describe("PaletteFormat.hex.parse", () => {
  test("reads one color per line, with or without a hash", () => {
    const file = PaletteFormat.hex.parse("000000\n#ff004d\n29adff80\n");

    assert.equal(file.name, null);
    assert.deepEqual(file.colors, [kBlack, kCoral, kGlass]);
  });

  test("reports the line of an invalid color", () => {
    assert.throws(
      () => PaletteFormat.hex.parse("000000\n\nfff\n"),
      (error: unknown) => error instanceof PaletteParseError && error.line === 3
    );
  });
});

describe("PaletteFormat.fromFileName", () => {
  test("reads hex for a .hex name and gpl otherwise", () => {
    assert.equal(PaletteFormat.fromFileName("sunset.HEX"), PaletteFormat.hex);
    assert.equal(PaletteFormat.fromFileName("sunset.gpl"), PaletteFormat.gpl);
    assert.equal(PaletteFormat.fromFileName("sunset.txt"), PaletteFormat.gpl);
  });
});

describe("PaletteFormat serialize", () => {
  test("writes gpl that reads back the same, alpha only when needed", () => {
    const opaque = PaletteFormat.gpl.serialize(new PaletteFile([kBlack, kCoral], "Sunset"));
    const translucent = PaletteFormat.gpl.serialize(new PaletteFile([kGlass]));

    assert.equal(opaque, "GIMP Palette\nName: Sunset\n#\n  0   0   0\t000000\n255   0  77\tff004d\n");
    assert.ok(translucent.includes("Channels: RGBA\n"));
    assert.deepEqual(PaletteFormat.gpl.parse(translucent).colors, [kGlass]);
  });

  test("writes hex with eight digits only for translucent colors", () => {
    const text = PaletteFormat.hex.serialize(new PaletteFile([kCoral, kGlass]));

    assert.equal(text, "ff004d\n29adff80\n");
    assert.deepEqual(PaletteFormat.hex.parse(text).colors, [kCoral, kGlass]);
  });

  test("copies the colors it is given", () => {
    const colors = [{ ...kBlack }];
    const file = new PaletteFile(colors);

    colors[0].r = 9;

    assert.deepEqual(file.colors, [kBlack]);
  });
});
