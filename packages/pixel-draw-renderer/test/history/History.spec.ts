// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  History,
  type HistoryState
} from "#src/history/History.ts";
import type { RGBA8 } from "#src/types.ts";
import {
  HISTORY_TEXTURE_SIZE,
  makeHistoryBuffer
} from "../helpers/history/buffer.ts";
import { makeUvMap } from "../helpers/uv/map.ts";

// CONSTANTS
const kRed: RGBA8 = { r: 255, g: 0, b: 0, a: 255 };
const kWhite: RGBA8 = { r: 255, g: 255, b: 255, a: 255 };

describe("History", () => {
  describe("disabled (default)", () => {
    test("push/undo/redo/clear are no-ops that never fire onChange", () => {
      const states: HistoryState[] = [];
      const controller = new History(
        makeHistoryBuffer(),
        makeUvMap(HISTORY_TEXTURE_SIZE),
        {
          onChange: (state) => states.push(state)
        }
      );

      controller.push({
        action: "stroke",
        positions: [{ x: 0, y: 0 }],
        beforeColors: [kWhite],
        afterColor: kRed
      });

      assert.ok(!controller.enabled);
      assert.ok(!controller.canUndo);
      assert.strictEqual(controller.undo(), null);
      assert.ok(!controller.canRedo);
      assert.strictEqual(controller.redo(), null);

      controller.clear();
      assert.strictEqual(states.length, 0);
    });
  });

  describe("onChange", () => {
    test("fires after push, undo, redo, and clear, never on a no-op", () => {
      const states: HistoryState[] = [];
      const controller = new History(
        makeHistoryBuffer(),
        makeUvMap(HISTORY_TEXTURE_SIZE),
        {
          enabled: true,
          onChange: (state) => states.push(state)
        }
      );

      controller.push({
        action: "stroke",
        positions: [{ x: 0, y: 0 }],
        beforeColors: [kWhite],
        afterColor: kRed
      });
      assert.deepStrictEqual(
        states.at(-1),
        { canUndo: true, canRedo: false }
      );

      controller.undo();
      assert.deepStrictEqual(
        states.at(-1),
        { canUndo: false, canRedo: true }
      );

      controller.redo();
      assert.deepStrictEqual(
        states.at(-1),
        { canUndo: true, canRedo: false }
      );

      controller.clear();
      assert.deepStrictEqual(
        states.at(-1),
        { canUndo: false, canRedo: false }
      );

      assert.strictEqual(states.length, 4);

      controller.undo();
      controller.redo();
      assert.strictEqual(states.length, 4);
    });
  });
});
