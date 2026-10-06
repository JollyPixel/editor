// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  KeyBindings,
  isApplePlatform
} from "@jolly-pixel/controls";

// Import Internal Dependencies
import { bindHistoryShortcuts } from "../../src/shared/historyShortcuts.ts";

// CONSTANTS
const kMod: KeyboardEventInit = isApplePlatform() ?
  { metaKey: true } :
  { ctrlKey: true };
const kOtherMod: KeyboardEventInit = isApplePlatform() ?
  { ctrlKey: true } :
  { metaKey: true };

function setup() {
  const keyboard = new KeyBindings();
  const calls: string[] = [];
  const release = bindHistoryShortcuts({
    keyboard,
    history: {
      undo: () => calls.push("undo") > 0,
      redo: () => calls.push("redo") > 0
    }
  });

  function press(
    init: KeyboardEventInit
  ): boolean {
    const event = new KeyboardEvent("keydown", {
      cancelable: true,
      ...init
    });

    return keyboard.dispatch(event);
  }

  return { release, calls, press };
}

describe("HistoryShortcuts", () => {
  it("undoes on the platform Mod+Z only", () => {
    const { calls, press } = setup();

    assert.equal(press({ code: "KeyZ", key: "z", ...kMod }), true);
    assert.equal(press({ code: "KeyZ", key: "z", ...kOtherMod }), false);

    assert.deepEqual(calls, ["undo"]);
  });

  it("follows the printed Z on AZERTY", () => {
    const { calls, press } = setup();

    press({ code: "KeyW", key: "z", ...kMod });
    press({ code: "KeyZ", key: "w", ...kMod });

    assert.deepEqual(calls, ["undo"]);
  });

  it("redoes on Mod+Shift+Z and Mod+Y", () => {
    const { calls, press } = setup();

    press({ code: "KeyZ", key: "Z", shiftKey: true, ...kMod });
    press({ code: "KeyY", key: "y", ...kMod });

    assert.deepEqual(calls, ["redo", "redo"]);
  });

  it("ignores the keys without a modifier or with Alt", () => {
    const { calls, press } = setup();

    assert.equal(press({ code: "KeyZ", key: "z" }), false);
    press({ code: "KeyY", key: "y" });
    press({ code: "KeyZ", key: "z", altKey: true, ...kMod });

    assert.deepEqual(calls, []);
  });

  it("stops answering the keys once disposed", () => {
    const { release, calls, press } = setup();

    release();
    press({ code: "KeyZ", key: "z", ...kMod });
    press({ code: "KeyY", key: "y", ...kMod });

    assert.deepEqual(calls, []);
  });
});
