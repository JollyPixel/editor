// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PaletteFile } from "../src/palette/PaletteFile.ts";
import { PaletteParseError } from "../src/palette/errors/PaletteParseError.ts";
import type { RGBA8 } from "../src/types.ts";

// CONSTANTS
const kBlack: RGBA8 = { r: 0, g: 0, b: 0, a: 255 };
const kCoral: RGBA8 = { r: 255, g: 0, b: 77, a: 255 };
const kGlass: RGBA8 = { r: 41, g: 173, b: 255, a: 128 };

describe("PaletteFile.parse gpl", () => {
  test("reads the name and colors, skipping comments and columns", () => {
    const file = PaletteFile.parse([
      "GIMP Palette",
      "Name: Sunset",
      "Columns: 4",
      "# a comment",
      "  0   0   0\tBlack",
      "255   0  77",
      ""
    ].join("\r\n"), "gpl");

    assert.equal(file.name, "Sunset");
    assert.deepEqual(file.colors, [kBlack, kCoral]);
  });

  test("reads an alpha column after 'Channels: RGBA'", () => {
    const file = PaletteFile.parse([
      "GIMP Palette",
      "Channels: RGBA",
      " 41 173 255 128 Glass"
    ].join("\n"), "gpl");

    assert.deepEqual(file.colors, [kGlass]);
  });

  test("reports the line of a broken row", () => {
    assert.throws(
      () => PaletteFile.parse("GIMP Palette\n0 0 0\n0 256 0\n", "gpl"),
      (error: unknown) => error instanceof PaletteParseError && error.line === 3
    );
  });

  test("rejects a file without the header or without colors", () => {
    assert.throws(() => PaletteFile.parse("0 0 0\n", "gpl"), PaletteParseError);
    assert.throws(() => PaletteFile.parse("GIMP Palette\n#\n", "gpl"), PaletteParseError);
  });
});

describe("PaletteFile.parse hex", () => {
  test("reads one color per line, with or without a hash", () => {
    const file = PaletteFile.parse("000000\n#ff004d\n29adff80\n", "hex");

    assert.equal(file.name, null);
    assert.deepEqual(file.colors, [kBlack, kCoral, kGlass]);
  });

  test("reports the line of an invalid color", () => {
    assert.throws(
      () => PaletteFile.parse("000000\n\nfff\n", "hex"),
      (error: unknown) => error instanceof PaletteParseError && error.line === 3
    );
  });
});

describe("PaletteFile.serialize", () => {
  test("writes gpl that reads back the same, alpha only when needed", () => {
    const opaque = new PaletteFile([kBlack, kCoral], "Sunset").serialize("gpl");
    const translucent = new PaletteFile([kGlass]).serialize("gpl");

    assert.equal(opaque, "GIMP Palette\nName: Sunset\n#\n  0   0   0\t000000\n255   0  77\tff004d\n");
    assert.ok(translucent.includes("Channels: RGBA\n"));
    assert.deepEqual(PaletteFile.parse(translucent, "gpl").colors, [kGlass]);
  });

  test("writes hex with eight digits only for translucent colors", () => {
    const text = new PaletteFile([kCoral, kGlass]).serialize("hex");

    assert.equal(text, "ff004d\n29adff80\n");
    assert.deepEqual(PaletteFile.parse(text, "hex").colors, [kCoral, kGlass]);
  });

  test("copies the colors it is given", () => {
    const colors = [{ ...kBlack }];
    const file = new PaletteFile(colors);

    colors[0].r = 9;

    assert.deepEqual(file.colors, [kBlack]);
  });
});
