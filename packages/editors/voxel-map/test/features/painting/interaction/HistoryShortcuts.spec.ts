// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  HistoryShortcuts,
  type HistoryShortcutListener
} from "../../../../src/features/painting/interaction/HistoryShortcuts.ts";

function setup() {
  const listeners = new Map<string, HistoryShortcutListener>();
  const calls: string[] = [];
  const shortcuts = new HistoryShortcuts({
    keyboard: {
      on: (code, listener) => {
        listeners.set(code, listener);
      },
      off: (code) => {
        listeners.delete(code);
      }
    },
    history: {
      undo: () => calls.push("undo") > 0,
      redo: () => calls.push("redo") > 0
    }
  });

  function press(
    code: string,
    modifiers: Partial<KeyboardEventInit> = {}
  ): boolean {
    const event = new KeyboardEvent("keydown", {
      code,
      cancelable: true,
      ...modifiers
    });
    listeners.get(code)?.(event);

    return event.defaultPrevented;
  }

  return { shortcuts, listeners, calls, press };
}

describe("HistoryShortcuts", () => {
  it("undoes on Ctrl+Z and Cmd+Z", () => {
    const { calls, press } = setup();

    assert.equal(press("KeyZ", { ctrlKey: true }), true);
    press("KeyZ", { metaKey: true });

    assert.deepEqual(calls, ["undo", "undo"]);
  });

  it("redoes on Ctrl+Shift+Z and Ctrl+Y", () => {
    const { calls, press } = setup();

    press("KeyZ", { ctrlKey: true, shiftKey: true });
    press("KeyY", { ctrlKey: true });

    assert.deepEqual(calls, ["redo", "redo"]);
  });

  it("ignores the keys without a modifier or with Alt", () => {
    const { calls, press } = setup();

    assert.equal(press("KeyZ"), false);
    press("KeyY");
    press("KeyZ", { ctrlKey: true, altKey: true });

    assert.deepEqual(calls, []);
  });

  it("unbinds every key on dispose", () => {
    const { shortcuts, listeners } = setup();

    shortcuts.dispose();

    assert.equal(listeners.size, 0);
  });
});
