// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { GridStyleValue } from "#src/grid/GridStyleValue.ts";

describe("GridStyleValue", () => {
  describe("clone", () => {
    test("returns a distinct instance with the same value", () => {
      const style = new GridStyleValue("cross", "cellStyle");
      const cloned = style.clone();

      assert.notStrictEqual(cloned, style);
      assert.strictEqual(cloned.value, "cross");
    });
  });
});
