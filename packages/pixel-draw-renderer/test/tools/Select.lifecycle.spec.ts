// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Select } from "#src/tools/Select.ts";
import { RED } from "../helpers/select-tool/snapshots.ts";

describe("Select", () => {
  describe("create flow", () => {
    test("startCreate arms a 1x1 rect and enters 'creating'", () => {
      const tool = new Select();
      const rect = tool.startCreate({ x: 2, y: 2 });

      assert.strictEqual(tool.state, "creating");
      assert.deepStrictEqual(rect, { x: 2, y: 2, width: 1, height: 1 });
      assert.deepStrictEqual(tool.rect, rect);
    });

    test("updateCreate spans the start corner and the cursor in any drag direction", () => {
      const cases = [
        {
          start: { x: 2, y: 2 },
          cursor: { x: 4, y: 5 },
          expected: { x: 2, y: 2, width: 3, height: 4 }
        },
        {
          start: { x: 5, y: 5 },
          cursor: { x: 2, y: 1 },
          expected: { x: 2, y: 1, width: 4, height: 5 }
        }
      ];

      for (const { start, cursor, expected } of cases) {
        const tool = new Select();
        tool.startCreate(start);

        assert.deepStrictEqual(tool.updateCreate(cursor), expected);
      }
    });
  });

  describe("move flow", () => {
    test("a click-only drag places a floating paste and consumes skipErase", () => {
      const tool = new Select();
      tool.startCreate({ x: 0, y: 0 });
      tool.finishCreate([RED]);
      const snapshot = tool.exportSnapshot()!;
      tool.importSnapshot(snapshot);

      tool.startMove({ x: 0, y: 0 });
      tool.updateMove({ x: 0, y: 0 });
      const placement = tool.finishMove();
      assert.deepStrictEqual(placement, {
        source: { x: 0, y: 0, width: 1, height: 1 },
        dest: { x: 0, y: 0, width: 1, height: 1 },
        skipErase: true
      });

      tool.startMove({ x: 0, y: 0 });
      tool.updateMove({ x: 5, y: 5 });
      const result = tool.finishMove();

      assert.ok(!result!.skipErase);
    });
  });

  describe("clear", () => {
    test("resets to idle and drops the active snapshot", () => {
      const tool = new Select();
      tool.startCreate({ x: 0, y: 0 });
      tool.finishCreate([RED]);
      tool.clear();

      assert.strictEqual(tool.state, "idle");
      assert.strictEqual(tool.rect, null);
      assert.strictEqual(tool.snapshot, null);
    });
  });

  describe("snapshot import / export", () => {
    test("snapshot boundaries are defensively copied", () => {
      const tool = new Select();
      tool.startCreate({ x: 0, y: 0 });
      tool.finishCreate([RED]);
      const snapshot = tool.exportSnapshot()!;
      tool.importSnapshot(snapshot);
      snapshot.pixels[0].r = 99;
      snapshot.mask[0] = false;

      assert.deepStrictEqual(tool.snapshot, [RED]);
      assert.deepStrictEqual(tool.mask, [true]);
    });
  });
});
