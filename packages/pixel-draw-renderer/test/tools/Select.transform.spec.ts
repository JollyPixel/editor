// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Select } from "#src/tools/Select.ts";
import type { RGBA8 } from "#src/types.ts";
import {
  COLOR_A,
  COLOR_B,
  COLOR_C,
  COLOR_D,
  COLOR_E,
  COLOR_F,
  SNAPSHOT_2X3,
  SNAPSHOT_2X4
} from "../helpers/select-tool/snapshots.ts";

describe("Select", () => {
  describe("rotate / flip (instance)", () => {
    function makeSelectedWith(
      rect: { x: number; y: number; width: number; height: number; },
      snapshot: RGBA8[]
    ): Select {
      const tool = new Select();
      tool.startCreate({
        x: rect.x,
        y: rect.y
      });
      tool.updateCreate({
        x: rect.x + rect.width - 1,
        y: rect.y + rect.height - 1
      });
      tool.finishCreate(snapshot);

      return tool;
    }

    test("rotate swaps rect dimensions (center-pivoted) and rotates the snapshot", () => {
      const tool = makeSelectedWith({
        x: 5,
        y: 5,
        width: 2,
        height: 3
      }, SNAPSHOT_2X3);

      const result = tool.rotate();

      assert.deepStrictEqual(result, {
        oldRect: { x: 5, y: 5, width: 2, height: 3 },
        newRect: { x: 5, y: 6, width: 3, height: 2 }
      });
      assert.deepStrictEqual(tool.rect, result!.newRect);
      assert.deepStrictEqual(tool.snapshot, [
        COLOR_E,
        COLOR_C,
        COLOR_A,
        COLOR_F,
        COLOR_D,
        COLOR_B
      ]);
      assert.strictEqual(tool.state, "selected");
    });

    test("rotate applied 4 times returns to the exact original rect and content", () => {
      const tool = makeSelectedWith({
        x: 5,
        y: 5,
        width: 2,
        height: 4
      }, SNAPSHOT_2X4);

      let last;
      for (let i = 0; i < 4; i++) {
        last = tool.rotate();
      }

      assert.deepStrictEqual(
        last!.newRect,
        { x: 5, y: 5, width: 2, height: 4 }
      );
      assert.deepStrictEqual(tool.snapshot, SNAPSHOT_2X4);
    });

    test("flipHorizontal mirrors content left-right and leaves the rect unchanged", () => {
      const tool = makeSelectedWith({
        x: 1,
        y: 1,
        width: 2,
        height: 3
      }, SNAPSHOT_2X3);

      const rect = tool.flipHorizontal();

      assert.deepStrictEqual(
        rect,
        { x: 1, y: 1, width: 2, height: 3 }
      );
      assert.deepStrictEqual(tool.rect, rect);
      assert.deepStrictEqual(
        tool.snapshot,
        [COLOR_B, COLOR_A, COLOR_D, COLOR_C, COLOR_F, COLOR_E]
      );
    });

    test("flipVertical mirrors content top-bottom and leaves the rect unchanged", () => {
      const tool = makeSelectedWith({
        x: 1,
        y: 1,
        width: 2,
        height: 3
      }, SNAPSHOT_2X3);

      const rect = tool.flipVertical();

      assert.deepStrictEqual(rect, { x: 1, y: 1, width: 2, height: 3 });
      assert.deepStrictEqual(tool.rect, rect);
      assert.deepStrictEqual(
        tool.snapshot,
        [COLOR_E, COLOR_F, COLOR_C, COLOR_D, COLOR_A, COLOR_B]
      );
    });
  });
});
