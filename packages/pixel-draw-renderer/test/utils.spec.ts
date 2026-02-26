// Import Node.js Dependencies
import { describe, test, before } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import { hexToRgb, rgbToHex, getColorAsRGBA } from "../src/utils.ts";
import { installCanvasMock } from "./mocks.ts";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();

before(() => {
  globalThis.document = kEmulatedBrowserWindow.document as unknown as Document;
  installCanvasMock(globalThis.document);
});

describe("hexToRgb", () => {
  test("converts black correctly", () => {
    const result = hexToRgb("#000000");
    assert.deepStrictEqual(result, { r: 0, g: 0, b: 0 });
  });

  test("converts white correctly", () => {
    const result = hexToRgb("#ffffff");
    assert.deepStrictEqual(result, { r: 255, g: 255, b: 255 });
  });

  test("converts red correctly", () => {
    const result = hexToRgb("#ff0000");
    assert.deepStrictEqual(result, { r: 255, g: 0, b: 0 });
  });

  test("converts a mixed color correctly", () => {
    const result = hexToRgb("#1a2b3c");
    assert.deepStrictEqual(result, { r: 26, g: 43, b: 60 });
  });
});

describe("rgbToHex", () => {
  test("converts black correctly", () => {
    assert.strictEqual(rgbToHex(0, 0, 0), "#000000");
  });

  test("converts white correctly", () => {
    assert.strictEqual(rgbToHex(255, 255, 255), "#ffffff");
  });

  test("converts red correctly", () => {
    assert.strictEqual(rgbToHex(255, 0, 0), "#ff0000");
  });

  test("throws on out-of-range values", () => {
    assert.throws(() => rgbToHex(-1, 0, 0), /must be between 0 and 255/);
    assert.throws(() => rgbToHex(0, 256, 0), /must be between 0 and 255/);
  });

  test("round-trips with hexToRgb", () => {
    const hex = "#4a7bce";
    const { r, g, b } = hexToRgb(hex);
    assert.strictEqual(rgbToHex(r, g, b), hex);
  });
});

describe("getColorAsRGBA", () => {
  test("returns opaque white for #ffffff", () => {
    const [r, g, b, a] = getColorAsRGBA("#ffffff");
    assert.strictEqual(r, 255);
    assert.strictEqual(g, 255);
    assert.strictEqual(b, 255);
    assert.strictEqual(a, 255);
  });

  test("returns opaque black for #000000", () => {
    const [r, g, b, a] = getColorAsRGBA("#000000");
    assert.strictEqual(r, 0);
    assert.strictEqual(g, 0);
    assert.strictEqual(b, 0);
    assert.strictEqual(a, 255);
  });

  test("returns four components", () => {
    const result = getColorAsRGBA("#ff0000");
    assert.strictEqual(result.length, 4);
  });
});
