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

describe("HistoryStack", () => {
  describe("canUndo / canRedo", () => {
    test("both false on a fresh stack; canUndo becomes true after a push", () => {
      const stack = new HistoryStack<string>();
      assert.ok(!stack.canUndo);
      assert.ok(!stack.canRedo);

      stack.push("a");

      assert.ok(stack.canUndo);
      assert.ok(!stack.canRedo);
    });
  });

  describe("undo / redo", () => {
    test("move entries between the stacks and return them", () => {
      const stack = new HistoryStack<string>();
      stack.push("a");
      stack.push("b");

      assert.equal(stack.undo(), "b");
      assert.equal(stack.undo(), "a");
      assert.equal(stack.undo(), null);
      assert.equal(stack.redo(), "a");
      assert.equal(stack.redo(), "b");
      assert.equal(stack.redo(), null);
    });
  });

  describe("push", () => {
    test("clears the redo stack", () => {
      const stack = new HistoryStack<string>();

      stack.push("a");
      stack.undo();
      assert.ok(stack.canRedo);

      stack.push("b");
      assert.ok(!stack.canRedo);
    });

    test("evicts the oldest entry once past the configured limit", () => {
      const stack = new HistoryStack<number>({ limit: 2 });

      for (let i = 0; i < 3; i++) {
        stack.push(i);
      }

      assert.equal(stack.undo(), 2);
      assert.equal(stack.undo(), 1);
      assert.equal(stack.undo(), null);
    });

    test("defaults to a limit of 10", () => {
      const stack = new HistoryStack<number>();

      for (let i = 0; i < 11; i++) {
        stack.push(i);
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
      const stack = new HistoryStack<string>();

      stack.push("a");
      stack.undo();
      assert.ok(stack.canRedo);

      stack.clear();
      assert.ok(!stack.canUndo);
      assert.ok(!stack.canRedo);
    });
  });
});
