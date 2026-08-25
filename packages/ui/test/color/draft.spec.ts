// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { parseFieldColor } from "../../src/color/draft.ts";

describe("parseFieldColor", () => {
  it("should refuse four digit hex, which is a half-typed six digit value", () => {
    assert.strictEqual(parseFieldColor("#ff66"), null);
    assert.strictEqual(parseFieldColor("ff66"), null);
    assert.strictEqual(parseFieldColor("  #FF66  "), null);
  });

  it("should accept the three digit shorthand it is not ambiguous with", () => {
    assert.deepStrictEqual(
      parseFieldColor("#f60"),
      {
        r: 1,
        g: 102 / 255,
        b: 0,
        a: 1
      }
    );
  });

  it("should accept a complete six digit value", () => {
    assert.deepStrictEqual(
      parseFieldColor("#ff6600"),
      {
        r: 1,
        g: 102 / 255,
        b: 0,
        a: 1
      }
    );
  });

  it("should accept eight digit hex, which carries its own alpha", () => {
    const color = parseFieldColor("#ff660080");

    assert.strictEqual(color?.a, 128 / 255);
  });

  it("should defer to parseColor for every other notation", () => {
    assert.deepStrictEqual(
      parseFieldColor("rgb(255 102 0)"),
      parseFieldColor("#ff6600")
    );
    assert.strictEqual(parseFieldColor("not-a-color"), null);
    assert.strictEqual(parseFieldColor(""), null);
  });
});
