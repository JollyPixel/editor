// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import {
  KeyBindings,
  KeyChord
} from "../../../src/index.ts";

// CONSTANTS
const kWindow = new Window();

function keydown(
  init: Pick<KeyboardEventInit, "code" | "key">
): KeyboardEvent {
  return new kWindow.KeyboardEvent("keydown", {
    cancelable: true,
    ...init
  }) as unknown as KeyboardEvent;
}

describe("Controls.KeyBindings", () => {
  test("dispatch() reports whether a binding handled the event", () => {
    const bindings = new KeyBindings();
    bindings.bind("g", () => undefined);
    const handled = keydown({ code: "KeyG", key: "g" });
    const ignored = keydown({ code: "KeyH", key: "h" });

    assert.equal(bindings.dispatch(handled), true);
    assert.equal(handled.defaultPrevented, true);
    assert.equal(bindings.dispatch(ignored), false);
    assert.equal(ignored.defaultPrevented, false);
  });

  test("dispatch() reports a declined event as unhandled", () => {
    const bindings = new KeyBindings();
    bindings.bind("Enter", () => false);
    const event = keydown({ code: "Enter", key: "Enter" });

    assert.equal(bindings.dispatch(event), false);
    assert.equal(event.defaultPrevented, false);
  });

  test("bind() takes KeyChord instances beside chord strings", () => {
    const bindings = new KeyBindings();
    const calls: string[] = [];
    bindings.bind(new KeyChord({ code: "KeyQ" }), () => {
      calls.push("q");
    });
    bindings.bind([KeyChord.parse("Enter"), "Escape"], () => {
      calls.push("confirm");
    });

    bindings.dispatch(keydown({ code: "KeyQ", key: "a" }));
    bindings.dispatch(keydown({ code: "Enter", key: "Enter" }));
    bindings.dispatch(keydown({ code: "Escape", key: "Escape" }));

    assert.deepEqual(calls, ["q", "confirm", "confirm"]);
  });
});
