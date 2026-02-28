// Import Node.js Dependencies
import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { UVHistory, type UVCommand } from "../src/UVHistory.ts";

function makeCounter(id: string = "r1"): {
  value: number;
  makeCommand(delta: number): UVCommand;
} {
  const state = { value: 0 };

  return {
    get value() {
      return state.value;
    },
    makeCommand(delta: number): UVCommand {
      return {
        type: "move",
        regionId: id,
        execute() {
          state.value += delta;
        },
        undo() {
          state.value -= delta;
        }
      };
    }
  };
}

describe("UVHistory", () => {
  let history: UVHistory;

  beforeEach(() => {
    history = new UVHistory();
  });

  describe("initial state", () => {
    test("canUndo and canRedo are false when empty", () => {
      assert.strictEqual(history.canUndo, false);
      assert.strictEqual(history.canRedo, false);
    });

    test("undo() on empty stack does not throw", () => {
      assert.doesNotThrow(() => history.undo());
    });

    test("redo() on empty stack does not throw", () => {
      assert.doesNotThrow(() => history.redo());
    });
  });

  describe("push / undo / redo", () => {
    test("push enables canUndo", () => {
      const { makeCommand } = makeCounter();
      history.push(makeCommand(1));
      assert.strictEqual(history.canUndo, true);
    });

    test("undo calls command.undo and enables canRedo", () => {
      const counter = makeCounter();
      // UVMap pattern: caller pre-applies the change, push just records it.
      counter.makeCommand(5).execute();
      const cmd = counter.makeCommand(5);
      history.push(cmd);
      history.undo();
      assert.strictEqual(counter.value, 0, "undo should reverse the pre-applied change");
      assert.strictEqual(history.canRedo, true);
      assert.strictEqual(history.canUndo, false);
    });

    test("redo calls command.execute", () => {
      const counter = makeCounter();
      // Pre-apply then push (same pattern as UVMap transactional methods).
      counter.makeCommand(3).execute();
      const cmd = counter.makeCommand(3);
      history.push(cmd);
      history.undo();
      history.redo();
      assert.strictEqual(counter.value, 3, "redo should re-apply the change");
      assert.strictEqual(history.canUndo, true);
      assert.strictEqual(history.canRedo, false);
    });

    test("push after undo clears redo stack", () => {
      const counter = makeCounter();
      history.push(counter.makeCommand(1));
      history.undo();
      history.push(counter.makeCommand(1));
      assert.strictEqual(history.canRedo, false, "redo stack should be cleared");
    });
  });

  describe("tryMerge coalescing", () => {
    test("consecutive merge-compatible commands are absorbed into one entry", () => {
      // Build a command that has tryMerge
      const counter = { value: 0 };

      function makeMovCmd(delta: number): UVCommand & { _d: number; } {
        let acc = delta;

        return {
          type: "move",
          regionId: "r1",
          _d: delta,
          execute() {
            counter.value += acc;
          },
          undo() {
            counter.value -= acc;
          },
          tryMerge(other) {
            if (other.type !== "move" || other.regionId !== "r1") {
              return false;
            }
            acc += (other as ReturnType<typeof makeMovCmd>)._d;

            return true;
          }
        };
      }

      history.push(makeMovCmd(1));
      history.push(makeMovCmd(2));
      history.push(makeMovCmd(3));

      // All three should be coalesced into one stack entry
      assert.strictEqual(history.canUndo, true);
      history.undo();
      // After undo, canUndo should be false (only one entry existed)
      assert.strictEqual(history.canUndo, false);
    });

    test("non-matching commands are NOT merged", () => {
      makeCounter();

      const cmd1: UVCommand = {
        type: "move",
        regionId: "r1",
        execute() {
          // No-op
        },
        undo() {
          // No-op
        }
      };
      const cmd2: UVCommand = {
        type: "move",
        regionId: "r2",
        execute() {
          // No-op
        },
        undo() {
          // No-op
        }
      };

      history.push(cmd1);
      history.push(cmd2);

      // Two separate entries → canUndo after one undo, still canUndo after another
      history.undo();
      assert.strictEqual(history.canUndo, true, "should have second entry left");
    });
  });

  describe("maxSize cap", () => {
    test("stack is capped at maxSize", () => {
      const smallHistory = new UVHistory({ maxSize: 3 });
      for (let i = 0; i < 10; i++) {
        smallHistory.push({
          type: "move",
          regionId: "r1",
          execute() {
            // No-op
          },
          undo() {
            // No-op
          }
        });
      }
      // Undo 3 times should be possible, 4th should be a no-op
      let undoCount = 0;
      while (smallHistory.canUndo) {
        smallHistory.undo();
        undoCount++;
      }
      assert.strictEqual(undoCount, 3);
    });
  });

  describe("clear", () => {
    test("clear removes all undo and redo entries", () => {
      history.push({
        type: "move",
        regionId: "r1",
        execute() {
          // No-op
        },
        undo() {
          // No-op
        }
      });
      history.undo();
      history.clear();
      assert.strictEqual(history.canUndo, false);
      assert.strictEqual(history.canRedo, false);
    });
  });
});
