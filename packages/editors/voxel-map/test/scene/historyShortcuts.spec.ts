// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  Keyboard,
  type KeyCode
} from "@jolly-pixel/controls";

// Import Internal Dependencies
import { bindHistoryShortcuts } from "../../src/scene/historyShortcuts.ts";

function setup() {
  const keyboard = new Keyboard();
  const calls: string[] = [];
  const release = bindHistoryShortcuts({
    keyboard,
    history: {
      undo: () => calls.push("undo") > 0,
      redo: () => calls.push("redo") > 0
    }
  });

  function press(
    code: KeyCode,
    modifiers: Partial<KeyboardEventInit> = {}
  ): boolean {
    const event = new KeyboardEvent("keydown", {
      code,
      cancelable: true,
      ...modifiers
    });
    keyboard.emit(code, event);

    return event.defaultPrevented;
  }

  return { release, calls, press };
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

  it("stops answering the keys once disposed", () => {
    const { release, calls, press } = setup();

    release();
    press("KeyZ", { ctrlKey: true });
    press("KeyY", { ctrlKey: true });

    assert.deepEqual(calls, []);
  });
});
