// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  Keyboard,
  isApplePlatform,
  type KeyCode
} from "@jolly-pixel/controls";

// Import Internal Dependencies
import { bindHistoryShortcuts } from "../../src/scene/historyShortcuts.ts";

// CONSTANTS
const kMod: KeyboardEventInit = isApplePlatform() ?
  { metaKey: true } :
  { ctrlKey: true };
const kOtherMod: KeyboardEventInit = isApplePlatform() ?
  { ctrlKey: true } :
  { metaKey: true };

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
  it("undoes on the platform Mod+Z only", () => {
    const { calls, press } = setup();

    assert.equal(press("KeyZ", kMod), true);
    assert.equal(press("KeyZ", kOtherMod), false);

    assert.deepEqual(calls, ["undo"]);
  });

  it("redoes on Mod+Shift+Z and Mod+Y", () => {
    const { calls, press } = setup();

    press("KeyZ", { ...kMod, shiftKey: true });
    press("KeyY", kMod);

    assert.deepEqual(calls, ["redo", "redo"]);
  });

  it("ignores the keys without a modifier or with Alt", () => {
    const { calls, press } = setup();

    assert.equal(press("KeyZ"), false);
    press("KeyY");
    press("KeyZ", { ...kMod, altKey: true });

    assert.deepEqual(calls, []);
  });

  it("stops answering the keys once disposed", () => {
    const { release, calls, press } = setup();

    release();
    press("KeyZ", kMod);
    press("KeyY", kMod);

    assert.deepEqual(calls, []);
  });
});
