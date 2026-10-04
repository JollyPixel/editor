// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  HistoryStack
} from "#src/history/HistoryStack.ts";
import type { RGBA8 } from "#src/types.ts";
import {
  HISTORY_TEXTURE_SIZE,
  makeHistoryBuffer
} from "../helpers/history/buffer.ts";
import { makeUvMap } from "../helpers/uv/map.ts";

// CONSTANTS
const kRed: RGBA8 = { r: 255, g: 0, b: 0, a: 255 };
const kBlue: RGBA8 = { r: 0, g: 0, b: 255, a: 255 };
const kWhite: RGBA8 = { r: 255, g: 255, b: 255, a: 255 };

describe("HistoryStack", () => {
  describe("canUndo / canRedo", () => {
    test("both false on a fresh stack; canUndo becomes true after a push", () => {
      const stack = new HistoryStack(
        makeHistoryBuffer(),
        makeUvMap(HISTORY_TEXTURE_SIZE)
      );
      assert.ok(!stack.canUndo);
      assert.ok(!stack.canRedo);

      stack.push({
        action: "stroke",
        positions: [{ x: 0, y: 0 }],
        beforeColors: [kWhite],
        afterColor: kRed
      });

      assert.ok(stack.canUndo);
      assert.ok(!stack.canRedo);
    });
  });

  describe("push", () => {
    test("clears the redo stack", () => {
      const buffer = makeHistoryBuffer();
      const stack = new HistoryStack(
        buffer,
        makeUvMap(HISTORY_TEXTURE_SIZE)
      );

      stack.push({
        action: "stroke",
        positions: [{ x: 0, y: 0 }],
        beforeColors: [kWhite],
        afterColor: kRed
      });
      stack.undo();
      assert.ok(stack.canRedo);

      stack.push({
        action: "stroke",
        positions: [{ x: 1, y: 0 }],
        beforeColors: [kWhite],
        afterColor: kBlue
      });
      assert.ok(!stack.canRedo);
    });

    test("evicts the oldest entry once past the configured limit", () => {
      const buffer = makeHistoryBuffer();
      const stack = new HistoryStack(
        buffer,
        makeUvMap(HISTORY_TEXTURE_SIZE),
        { limit: 2 }
      );

      for (let i = 0; i < 3; i++) {
        stack.push({
          action: "stroke",
          positions: [{ x: i, y: 0 }],
          beforeColors: [kWhite],
          afterColor: kRed
        });
      }

      assert.notStrictEqual(stack.undo(), null);
      assert.notStrictEqual(stack.undo(), null);
      assert.strictEqual(stack.undo(), null);
    });

    test("defaults to a limit of 10", () => {
      const buffer = makeHistoryBuffer();
      const stack = new HistoryStack(
        buffer,
        makeUvMap(HISTORY_TEXTURE_SIZE)
      );

      for (let i = 0; i < 11; i++) {
        stack.push({
          action: "stroke",
          positions: [{ x: 0, y: 0 }],
          beforeColors: [kWhite],
          afterColor: kRed
        });
      }

      let undoCount = 0;
      while (stack.undo() !== null) {
        undoCount++;
      }
      assert.strictEqual(undoCount, 10);
    });
  });

  describe("clear", () => {
    test("discards both stacks", () => {
      const buffer = makeHistoryBuffer();
      const stack = new HistoryStack(
        buffer,
        makeUvMap(HISTORY_TEXTURE_SIZE)
      );

      stack.push({
        action: "stroke",
        positions: [{ x: 0, y: 0 }],
        beforeColors: [kWhite],
        afterColor: kRed
      });
      stack.undo();
      assert.ok(stack.canRedo);

      stack.clear();
      assert.ok(!stack.canUndo);
      assert.ok(!stack.canRedo);
    });
  });
});
