// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  FloatingSelection
} from "#src/rendering/compositing/FloatingSelection.ts";
import {
  RED,
  ERASE_COLOR
} from "../../helpers/compositing/colors.ts";

describe("FloatingSelection", () => {
  describe("changed signal", () => {
    function makeCreated(): {
      overlay: FloatingSelection;
      changes: () => number;
    } {
      const overlay = new FloatingSelection();
      let count = 0;
      overlay.on("changed", () => {
        count++;
      });

      return { overlay, changes: () => count };
    }

    const kSourceRect = {
      x: 0,
      y: 0,
      width: 1,
      height: 1
    };

    test("emits on create, updatePosition, and clear", () => {
      const { overlay, changes } = makeCreated();

      overlay.create({
        sourceRect: kSourceRect,
        pixels: [RED],
        eraseColor: ERASE_COLOR
      });
      assert.strictEqual(changes(), 1, "create");

      overlay.updatePosition({
        x: 2,
        y: 2,
        width: 1,
        height: 1
      });
      assert.strictEqual(changes(), 2, "updatePosition");

      overlay.clear();
      assert.strictEqual(changes(), 3, "clear");
    });

    test("clear does not emit when nothing is floating", () => {
      const { overlay, changes } = makeCreated();

      overlay.clear();

      assert.strictEqual(changes(), 0);
    });

    test("updatePosition does not emit when nothing is floating", () => {
      const { overlay, changes } = makeCreated();

      overlay.updatePosition({
        x: 1,
        y: 1,
        width: 1,
        height: 1
      });

      assert.strictEqual(changes(), 0);
    });
  });
});
