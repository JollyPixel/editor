// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { Keyboard } from "@jolly-pixel/controls";

// Import Internal Dependencies
import { bindKeyChain } from "../../src/shared/keyBindings.ts";

function pressEscape(
  keyboard: Keyboard
): void {
  keyboard.emit("Escape", new KeyboardEvent("keydown", { code: "Escape" }));
}

describe("bindKeyChain", () => {
  test("stops at the first handler that takes the key", () => {
    const keyboard = new Keyboard();
    const calls: string[] = [];
    let cancelling = true;
    bindKeyChain(keyboard, "Escape", [
      () => {
        calls.push("cancel");

        return cancelling;
      },
      () => {
        calls.push("camera");

        return true;
      }
    ]);

    pressEscape(keyboard);
    cancelling = false;
    pressEscape(keyboard);

    assert.deepEqual(calls, ["cancel", "cancel", "camera"]);
  });

  test("stops listening once disposed", () => {
    const keyboard = new Keyboard();
    let calls = 0;
    const release = bindKeyChain(keyboard, "Escape", [
      () => {
        calls++;

        return true;
      }
    ]);

    release();
    pressEscape(keyboard);

    assert.equal(calls, 0);
  });
});
