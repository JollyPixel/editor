// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach,
  afterEach
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import {
  Keyboard,
  isEditableTarget,
  type KeyCode
} from "../src/index.ts";
import * as mocks from "./mocks/index.ts";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();

describe("Controls.Keyboard", () => {
  let keyboard: Keyboard;
  let documentAdapter: KeyboardDocumentAdapter;

  beforeEach(() => {
    documentAdapter = new KeyboardDocumentAdapter();
    keyboard = new Keyboard({
      documentAdapter
    });
    keyboard.connect();
  });

  afterEach(() => {
    keyboard.disconnect();
  });

  test("should initialize with default values", () => {
    assert.strictEqual(keyboard.wasActive, false);
  });

  test("isDown resolves alphabet/numeric shorthands to their KeyCode, and handles ANY / NONE", () => {
    assert.strictEqual(keyboard.isDown("NONE"), true);
    assert.strictEqual(keyboard.isDown("ANY"), false);

    keyboard.buttonsDown.add("KeyA");

    assert.strictEqual(keyboard.isDown("A"), true);
    assert.strictEqual(keyboard.isDown("KeyA"), true);
    assert.strictEqual(keyboard.isDown("KeyB"), false);
    assert.strictEqual(keyboard.isDown("ANY"), true);
    assert.strictEqual(keyboard.isDown("NONE"), false);
  });

  test("wasJustPressed / wasJustReleased / wasJustAutoRepeated look up per-key state", () => {
    documentAdapter.dispatchEvent("keydown", { code: "KeyA" });
    keyboard.update();

    assert.strictEqual(keyboard.wasJustPressed("A"), true);
    assert.strictEqual(keyboard.wasJustPressed("KeyB"), false);

    documentAdapter.dispatchEvent("keydown", { code: "KeyA" });
    keyboard.update();
    assert.strictEqual(keyboard.wasJustAutoRepeated("A"), true);

    documentAdapter.dispatchEvent("keyup", { code: "KeyA" });
    keyboard.update();
    assert.strictEqual(keyboard.wasJustReleased("A"), true);
  });

  test("should detect key press", () => {
    documentAdapter.dispatchEvent("keydown", {
      code: "KeyA",
      key: "a"
    });

    keyboard.update();
    assert.strictEqual(keyboard.wasActive, true);

    const keyState = keyboard.buttons.get("KeyA")!;
    assert.equal(keyState.wasJustPressed, true);
    assert.equal(keyState.isDown, true);
  });

  test("should detect key release", () => {
    documentAdapter.dispatchEvent("keydown", { code: "KeyA" });
    keyboard.update();

    documentAdapter.dispatchEvent("keyup", { code: "KeyA" });
    keyboard.update();

    const keyState = keyboard.buttons.get("KeyA")!;
    assert.equal(keyState.wasJustReleased, true);
    assert.equal(keyState.isDown, false);
  });

  test("should handle auto repeat", () => {
    documentAdapter.dispatchEvent("keydown", { code: "KeyA" });
    keyboard.update();

    documentAdapter.dispatchEvent("keydown", { code: "KeyA" });
    keyboard.update();

    const keyState = keyboard.buttons.get("KeyA")!;
    assert.equal(keyState.wasJustAutoRepeated, true);
  });

  test("should capture character input", () => {
    documentAdapter.dispatchEvent("keypress", {
      key: "a"
    });

    keyboard.update();
    assert.equal(keyboard.char, "a");
  });

  test("should reset state correctly", () => {
    documentAdapter.dispatchEvent("keydown", { code: "KeyA" });
    keyboard.update();
    keyboard.reset();

    assert.equal(keyboard.buttons.size, 0);
    assert.equal(keyboard.buttonsDown.size, 0);
    assert.equal(keyboard.char, "");
    assert.equal(keyboard.autoRepeatedCode, null);
  });

  test("should handle multiple keys pressed simultaneously", () => {
    documentAdapter.dispatchEvent("keydown", { code: "KeyA" });
    documentAdapter.dispatchEvent("keydown", { code: "KeyB" });
    keyboard.update();

    const keyStateA = keyboard.buttons.get("KeyA")!;
    const keyStateB = keyboard.buttons.get("KeyB")!;

    assert.equal(keyStateA.isDown, true);
    assert.equal(keyStateB.isDown, true);
    assert.equal(keyboard.buttonsDown.size, 2);
  });

  test("should clear wasJustPressed after update cycle", () => {
    documentAdapter.dispatchEvent("keydown", { code: "KeyA" });
    keyboard.update();

    const keyStateFirstUpdate = keyboard.buttons.get("KeyA")!;
    assert.equal(keyStateFirstUpdate.wasJustPressed, true);

    keyboard.update();

    const keyStateSecondUpdate = keyboard.buttons.get("KeyA")!;
    assert.equal(keyStateSecondUpdate.wasJustPressed, false);
    assert.equal(keyStateSecondUpdate.isDown, true);
  });

  test("should clear wasJustReleased after update cycle", () => {
    documentAdapter.dispatchEvent("keydown", { code: "KeyA" });
    keyboard.update();

    documentAdapter.dispatchEvent("keyup", { code: "KeyA" });
    keyboard.update();

    const keyStateFirstUpdate = keyboard.buttons.get("KeyA")!;
    assert.equal(keyStateFirstUpdate.wasJustReleased, true);

    keyboard.update();

    const keyStateSecondUpdate = keyboard.buttons.get("KeyA")!;
    assert.equal(keyStateSecondUpdate.wasJustReleased, false);
  });

  test("should clear wasJustAutoRepeated after update cycle", () => {
    documentAdapter.dispatchEvent("keydown", { code: "KeyA" });
    keyboard.update();

    documentAdapter.dispatchEvent("keydown", { code: "KeyA" });
    keyboard.update();

    const keyStateFirstUpdate = keyboard.buttons.get("KeyA")!;
    assert.equal(keyStateFirstUpdate.wasJustAutoRepeated, true);

    keyboard.update();

    const keyStateSecondUpdate = keyboard.buttons.get("KeyA")!;
    assert.equal(keyStateSecondUpdate.wasJustAutoRepeated, false);
  });

  test("should update newChar property", () => {
    documentAdapter.dispatchEvent("keypress", { key: "x" });

    assert.equal(keyboard.newChar, "x");

    keyboard.update();
    assert.equal(keyboard.char, "x");
    assert.equal(keyboard.newChar, "");
  });

  test("should handle keyup without prior keydown", () => {
    documentAdapter.dispatchEvent("keyup", { code: "KeyA" });
    keyboard.update();

    const keyState = keyboard.buttons.get("KeyA");
    assert.equal(keyState, undefined);
  });

  test("should maintain buttonsDown set correctly", () => {
    documentAdapter.dispatchEvent("keydown", { code: "KeyA" });
    keyboard.update();

    assert.equal(keyboard.buttonsDown.has("KeyA"), true);

    documentAdapter.dispatchEvent("keyup", { code: "KeyA" });
    keyboard.update();

    assert.equal(keyboard.buttonsDown.has("KeyA"), false);
  });

  describe("enabled setter", () => {
    test("defaults to enabled", () => {
      assert.equal(keyboard.enabled, true);
    });

    test("disabling ignores subsequent keydown/keyup events", () => {
      keyboard.enabled = false;
      documentAdapter.dispatchEvent("keydown", { code: "KeyA" });
      keyboard.update();

      assert.equal(keyboard.buttonsDown.has("KeyA"), false);
      assert.equal(keyboard.buttons.size, 0);
    });

    test("disabling releases keys already held so polling consumers see them let go", () => {
      documentAdapter.dispatchEvent("keydown", { code: "KeyW" });
      keyboard.update();
      assert.equal(keyboard.buttonsDown.has("KeyW"), true);

      keyboard.enabled = false;

      assert.equal(keyboard.buttonsDown.has("KeyW"), false);
    });

    test("re-enabling resumes tracking new keydown/keyup events", () => {
      keyboard.enabled = false;
      keyboard.enabled = true;

      documentAdapter.dispatchEvent("keydown", { code: "KeyA" });
      keyboard.update();

      assert.equal(keyboard.buttonsDown.has("KeyA"), true);
    });

    test("is a no-op when already in the requested state", () => {
      documentAdapter.dispatchEvent("keydown", { code: "KeyA" });
      keyboard.update();

      keyboard.enabled = true;

      assert.equal(keyboard.buttonsDown.has("KeyA"), true);
    });
  });

  describe("editable targets", () => {
    test("keydown inside an editable control is ignored", () => {
      documentAdapter.dispatchEvent("keydown", {
        code: "KeyW",
        target: createElement("input")
      });
      keyboard.update();

      assert.equal(keyboard.buttonsDown.has("KeyW"), false);
      assert.equal(keyboard.buttons.size, 0);
    });

    test("keypress inside an editable control does not accumulate char", () => {
      documentAdapter.dispatchEvent("keypress", {
        key: "a",
        target: createElement("textarea")
      });
      keyboard.update();

      assert.equal(keyboard.char, "");
    });

    test("keyup is never ignored, so a key held on the canvas releases inside a field", () => {
      documentAdapter.dispatchEvent("keydown", { code: "KeyW" });
      keyboard.update();
      assert.equal(keyboard.buttonsDown.has("KeyW"), true);

      documentAdapter.dispatchEvent("keyup", {
        code: "KeyW",
        target: createElement("input")
      });
      keyboard.update();

      assert.equal(keyboard.buttonsDown.has("KeyW"), false);
    });

    test("keydown on a non editable target is still tracked", () => {
      documentAdapter.dispatchEvent("keydown", {
        code: "KeyW",
        target: createElement("div")
      });
      keyboard.update();

      assert.equal(keyboard.buttonsDown.has("KeyW"), true);
    });
  });

  describe("control keys", () => {
    test("Tab is not prevented, so focus can leave the canvas", () => {
      const event = documentAdapter.dispatchEvent("keydown", { code: "Tab" });

      assert.equal(event.defaultPrevented, false);
      assert.equal(keyboard.buttonsDown.has("Tab"), true);
    });

    test("Escape is not prevented, so native dialog can close on it", () => {
      const event = documentAdapter.dispatchEvent(
        "keydown",
        // @ts-expect-error
        { code: "Escape" }
      );

      assert.equal(event.defaultPrevented, false);
      assert.equal(keyboard.buttonsDown.has("Escape"), true);
    });

    test("other control keys are still prevented", () => {
      const event = documentAdapter.dispatchEvent("keydown", { code: "ArrowUp" });

      assert.equal(event.defaultPrevented, true);
    });
  });

  describe("idle gating", () => {
    test("a full press/release cycle still publishes every transition", () => {
      documentAdapter.dispatchEvent("keydown", { code: "KeyW" });
      keyboard.update();
      assert.strictEqual(keyboard.isDown("KeyW"), true);
      assert.strictEqual(keyboard.wasJustPressed("KeyW"), true);

      keyboard.update();
      assert.strictEqual(keyboard.isDown("KeyW"), true);
      assert.strictEqual(keyboard.wasJustPressed("KeyW"), false);

      documentAdapter.dispatchEvent("keyup", { code: "KeyW" });
      keyboard.update();
      assert.strictEqual(keyboard.isDown("KeyW"), false);
      assert.strictEqual(keyboard.wasJustReleased("KeyW"), true);

      // The settling tick must still run even though nothing is held, or
      // wasJustReleased would stay true forever.
      keyboard.update();
      assert.strictEqual(keyboard.wasJustReleased("KeyW"), false);
      assert.strictEqual(keyboard.wasActive, false);
    });

    test("stays quiet across many idle ticks and still wakes on the next key", () => {
      for (let frame = 0; frame < 100; frame++) {
        keyboard.update();
      }
      assert.strictEqual(keyboard.wasActive, false);

      documentAdapter.dispatchEvent("keydown", { code: "KeyA" });
      keyboard.update();

      assert.strictEqual(keyboard.wasJustPressed("KeyA"), true);
      assert.strictEqual(keyboard.wasActive, true);
    });

    test("a typed character is still delivered after idle ticks", () => {
      for (let frame = 0; frame < 10; frame++) {
        keyboard.update();
      }

      documentAdapter.dispatchEvent("keypress", { code: "KeyA", key: "a" });
      keyboard.update();
      assert.strictEqual(keyboard.char, "a");

      keyboard.update();
      assert.strictEqual(keyboard.char, "");
    });

    test("auto-repeat is still observed after idle ticks", () => {
      documentAdapter.dispatchEvent("keydown", { code: "KeyW" });
      keyboard.update();
      keyboard.update();

      documentAdapter.dispatchEvent("keydown", { code: "KeyW" });
      keyboard.update();

      assert.strictEqual(keyboard.wasJustAutoRepeated("KeyW"), true);
    });
  });
});

describe("Controls.isEditableTarget", () => {
  test("matches an input anywhere in the composed path", () => {
    assert.equal(
      isEditableTarget({
        target: createElement("jolly-pane"),
        composedPath: () => [createElement("span"), createElement("input")]
      }),
      true
    );
  });

  test("prefers the composed path over target, which shadow DOM retargets to the host", () => {
    assert.equal(
      isEditableTarget({
        target: createElement("input"),
        composedPath: () => [createElement("div")]
      }),
      false
    );
  });

  test("matches a contenteditable element", () => {
    assert.equal(
      isEditableTarget({ composedPath: () => [{ isContentEditable: true }] }),
      true
    );
  });

  test("falls back to target when composedPath is absent, as on synthetic events", () => {
    assert.equal(isEditableTarget({ target: createElement("textarea") }), true);
    assert.equal(isEditableTarget({ target: createElement("div") }), false);
  });

  test("tolerates a missing or non object target", () => {
    assert.equal(isEditableTarget({}), false);
    assert.equal(isEditableTarget({ target: null }), false);
    assert.equal(isEditableTarget({ target: "input" }), false);
  });
});

function createElement(
  tagName: string
) {
  return kEmulatedBrowserWindow.document.createElement(tagName);
}

interface EventData {
  code?: KeyCode;
  key?: string;
  /** Stands in for the composed path, which an undispatched event cannot supply. */
  target?: unknown;
}

class KeyboardDocumentAdapter extends mocks.DocumentAdapter {
  dispatchEvent(
    type: "keydown" | "keypress" | "keyup",
    eventData: EventData
  ) {
    const event = new kEmulatedBrowserWindow.KeyboardEvent(type, {
      code: eventData.code || "",
      key: eventData.key || "",
      bubbles: true,
      cancelable: true
    });

    if ("target" in eventData) {
      Object.defineProperty(event, "composedPath", {
        value: () => [eventData.target]
      });
    }

    const listeners = this.listeners.get(type) ?? [];
    listeners.forEach((listener) => listener(event));

    return event;
  }
}
