// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { GridStyleValue } from "#src/grid/GridStyleValue.ts";

describe("GridStyleValue", () => {
  test("throws with the given label for an invalid style", () => {
    assert.throws(
      // @ts-expect-error Testing invalid style
      () => new GridStyleValue("invalid", "cellStyle"),
      /Invalid cellStyle "invalid"/
    );
  });

  test("value reflects the constructed style", () => {
    const style = new GridStyleValue("cross", "cellStyle");

    assert.strictEqual(style.value, "cross");
  });

  describe("clone", () => {
    test("returns a distinct instance with the same value", () => {
      const style = new GridStyleValue("cross", "cellStyle");
      const cloned = style.clone();

      assert.notStrictEqual(cloned, style);
      assert.strictEqual(cloned.value, "cross");
    });
  });
});
