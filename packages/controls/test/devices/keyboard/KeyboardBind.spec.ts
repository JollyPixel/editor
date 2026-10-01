// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach,
  afterEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  isApplePlatform,
  type Keyboard
} from "../../../src/index.ts";
import {
  createConnectedKeyboardFixture,
  type EventData,
  type KeyboardDocumentAdapter
} from "./Keyboard.fixture.ts";

// CONSTANTS
const kMod: EventData = isApplePlatform() ?
  { metaKey: true } :
  { ctrlKey: true };

describe("Controls.Keyboard bind", () => {
  let keyboard: Keyboard;
  let documentAdapter: KeyboardDocumentAdapter;

  beforeEach(() => {
    ({
      keyboard,
      documentAdapter
    } = createConnectedKeyboardFixture());
  });

  afterEach(() => {
    keyboard.disconnect();
  });

  function press(
    eventData: EventData
  ): boolean {
    return documentAdapter.dispatchEvent("keydown", eventData).defaultPrevented;
  }

  test("runs the handler for any listed chord and prevents the default", () => {
    const calls: string[] = [];
    keyboard.bind(["Mod+KeyY", "Mod+Shift+KeyZ"], (event) => {
      calls.push(event.code);
    });

    assert.equal(press({ code: "KeyY", ...kMod }), true);
    assert.equal(press({ code: "KeyZ", shiftKey: true, ...kMod }), true);
    assert.equal(press({ code: "KeyZ", ...kMod }), false);
    assert.equal(press({ code: "KeyY" }), false);

    assert.deepEqual(calls, ["KeyY", "KeyZ"]);
  });

  test("ignores auto-repeat unless the binding opts in", () => {
    const calls: string[] = [];
    keyboard.bind("KeyG", () => {
      calls.push("ghost");
    });
    keyboard.bind("BracketLeft", () => {
      calls.push("shrink");
    }, { repeat: true });

    press({ code: "KeyG", repeat: true });
    press({ code: "BracketLeft", repeat: true });

    assert.deepEqual(calls, ["shrink"]);
  });

  test("runs bindings by priority until one handles the key", () => {
    const calls: string[] = [];
    let placing = true;
    keyboard.bind("Escape", () => {
      calls.push("camera");
    });
    keyboard.bind("Escape", () => {
      calls.push("placement");

      return placing;
    }, { priority: 1 });

    press({ code: "Escape" });
    placing = false;
    const prevented = press({ code: "Escape" });

    assert.deepEqual(calls, ["placement", "placement", "camera"]);
    assert.equal(prevented, true);
  });

  test("keeps the default when no binding handles the key", () => {
    keyboard.bind("Enter", () => false);

    assert.equal(press({ code: "Enter" }), false);
  });

  test("the returned disposer removes only its binding", () => {
    const calls: string[] = [];
    const release = keyboard.bind("KeyR", () => {
      calls.push("first");
    }, { priority: 1 });
    keyboard.bind("KeyR", () => {
      calls.push("second");
    });

    release();
    release();
    press({ code: "KeyR" });

    assert.deepEqual(calls, ["second"]);
  });

  test("does not run while the keyboard ignores keydown", () => {
    let calls = 0;
    keyboard.bind("KeyR", () => {
      calls++;
    });

    keyboard.enabled = false;
    press({ code: "KeyR" });
    keyboard.enabled = true;
    const release = keyboard.suspend();
    press({ code: "KeyR" });
    release();

    assert.equal(calls, 0);
  });
});
