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
  SNAPSHOT_2X3
} from "../helpers/select-tool/snapshots.ts";

describe("Select", () => {
  describe("shape (mask-aware) selection", () => {
    const kMask = [true, false, false, true];
    const kAsymmetricMask = [true, false, true, true, false, false];

    test("hitTest follows the mask, so holes are not grab handles", () => {
      const tool = new Select();
      tool.selectRegion(
        { x: 0, y: 0, width: 2, height: 2 },
        SNAPSHOT_2X3.slice(0, 4),
        kMask
      );

      assert.ok(tool.hitTest({ x: 0, y: 0 }), "masked-in top-left");
      assert.ok(!tool.hitTest({ x: 1, y: 0 }), "masked-out top-right is a hole");
      assert.ok(!tool.hitTest({ x: 0, y: 1 }), "masked-out bottom-left is a hole");
      assert.ok(tool.hitTest({ x: 1, y: 1 }), "masked-in bottom-right");
      assert.ok(!tool.hitTest({ x: 2, y: 0 }), "outside the bounding rect entirely");
    });

    test("markErased only overwrites masked-in cells, leaving masked-out cells untouched", () => {
      const tool = new Select();
      tool.selectRegion(
        { x: 0, y: 0, width: 2, height: 2 },
        [COLOR_A, COLOR_B, COLOR_C, COLOR_D],
        kMask
      );

      const eraseColor: RGBA8 = {
        r: 255, g: 255, b: 255, a: 255
      };
      tool.markErased(eraseColor);

      assert.deepStrictEqual(
        tool.snapshot,
        [eraseColor, COLOR_B, COLOR_C, eraseColor]
      );
    });

    test("snapshot export/import round-trips the mask", () => {
      const tool = new Select();
      tool.selectRegion(
        { x: 3, y: 3, width: 2, height: 2 },
        [COLOR_A, COLOR_B, COLOR_C, COLOR_D],
        kMask
      );
      const snapshot = tool.exportSnapshot()!;
      tool.clear();
      tool.importSnapshot(snapshot);

      assert.deepStrictEqual(tool.mask, kMask);
    });

    test("rotate turns the mask clockwise with the snapshot", () => {
      const tool = new Select();
      tool.selectRegion(
        { x: 0, y: 0, width: 2, height: 3 },
        SNAPSHOT_2X3,
        kAsymmetricMask
      );

      tool.rotate();

      assert.strictEqual(tool.rect!.width, 3);
      assert.strictEqual(tool.rect!.height, 2);
      assert.deepStrictEqual(
        tool.mask,
        [false, true, true, false, true, false]
      );
    });

    test("flipHorizontal/flipVertical mirror the mask with the snapshot", () => {
      const tool = new Select();
      tool.selectRegion(
        { x: 0, y: 0, width: 2, height: 3 },
        SNAPSHOT_2X3,
        kAsymmetricMask
      );

      tool.flipHorizontal();
      assert.deepStrictEqual(
        tool.mask,
        [false, true, true, true, false, false]
      );

      tool.flipVertical();
      assert.deepStrictEqual(
        tool.mask,
        [false, false, true, true, false, true]
      );
    });
  });
});
