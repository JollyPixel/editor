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
import type { HistoryEdit } from "#src/history/HistoryEntry.ts";

// CONSTANTS
const kEdit: HistoryEdit = {
  redo: [
    {
      action: "resized",
      metadata: { size: { x: 2, y: 2 } }
    }
  ],
  undo: [
    {
      action: "resized",
      metadata: { size: { x: 1, y: 1 } }
    }
  ]
};

describe("History", () => {
  describe("disabled (default)", () => {
    test("push/undo/redo/clear are no-ops that never fire onChange or replay", () => {
      const states: HistoryState[] = [];
      const replayed: unknown[] = [];
      const history = new History({
        onChange: (state) => states.push(state)
      });

      history.push(kEdit);

      assert.ok(!history.enabled);
      assert.ok(!history.canUndo);
      assert.strictEqual(history.undo((entry) => replayed.push(entry)), null);
      assert.ok(!history.canRedo);
      assert.strictEqual(history.redo((entry) => replayed.push(entry)), null);

      history.clear();
      assert.strictEqual(states.length, 0);
      assert.strictEqual(replayed.length, 0);
    });
  });

  describe("push", () => {
    test("stamps the edit with a timestamp", (t) => {
      t.mock.timers.enable({ apis: ["Date"], now: 1234 });
      const history = new History({ enabled: true });

      history.push(kEdit);

      assert.deepStrictEqual(
        history.undo(() => undefined),
        { ...kEdit, timestamp: 1234 }
      );
    });
  });

  describe("onChange", () => {
    test("fires after push, undo, redo, and clear, never on a no-op", () => {
      const states: HistoryState[] = [];
      const history = new History({
        enabled: true,
        onChange: (state) => states.push(state)
      });

      history.push(kEdit);
      assert.deepStrictEqual(
        states.at(-1),
        { canUndo: true, canRedo: false }
      );

      history.undo(() => undefined);
      assert.deepStrictEqual(
        states.at(-1),
        { canUndo: false, canRedo: true }
      );

      history.redo(() => undefined);
      assert.deepStrictEqual(
        states.at(-1),
        { canUndo: true, canRedo: false }
      );

      history.clear();
      assert.deepStrictEqual(
        states.at(-1),
        { canUndo: false, canRedo: false }
      );

      assert.strictEqual(states.length, 4);

      history.undo(() => undefined);
      history.redo(() => undefined);
      assert.strictEqual(states.length, 4);
    });

    test("fires only after the replay ran", () => {
      const order: string[] = [];
      const history = new History({
        enabled: true,
        onChange: () => order.push("change")
      });
      history.push(kEdit);
      order.length = 0;

      history.undo(() => order.push("replay"));
      history.redo(() => order.push("replay"));

      assert.deepStrictEqual(order, ["replay", "change", "replay", "change"]);
    });
  });
});
