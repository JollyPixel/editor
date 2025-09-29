// Import Node.js Dependencies
import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { BrowserWindow, Window } from "happy-dom";

// Import Internal Dependencies
import { Keyboard } from "../../src/controls/targets/Keyboard.class.js";

// CONSTANTS
const kWindow = new Window();

describe("Controls.Keyboard", () => {
  let keyboard: Keyboard;
  let mockedDocumentAdapter: MockEventTarget;

  beforeEach(() => {
    mockedDocumentAdapter = new MockEventTarget();
    keyboard = new Keyboard({
      documentAdapter: mockedDocumentAdapter as unknown as Document
    });
    keyboard.connect();
  });

  afterEach(() => {
    keyboard.disconnect();
  });

  test("should detect key press", () => {
    mockedDocumentAdapter.dispatchKeyboardEvent("keydown", {
      code: "KeyA",
      key: "a"
    });

    keyboard.update();

    const keyState = keyboard.buttons.get("KeyA")!;
    assert.equal(keyState.wasJustPressed, true);
    assert.equal(keyState.isDown, true);
  });

  test("should detect key release", () => {
    mockedDocumentAdapter.dispatchKeyboardEvent("keydown", { code: "KeyA" });
    keyboard.update();

    mockedDocumentAdapter.dispatchKeyboardEvent("keyup", { code: "KeyA" });
    keyboard.update();

    const keyState = keyboard.buttons.get("KeyA")!;
    assert.equal(keyState.wasJustReleased, true);
    assert.equal(keyState.isDown, false);
  });

  test("should handle auto repeat", () => {
    mockedDocumentAdapter.dispatchKeyboardEvent("keydown", { code: "KeyA" });
    keyboard.update();

    mockedDocumentAdapter.dispatchKeyboardEvent("keydown", { code: "KeyA" });
    keyboard.update();

    const keyState = keyboard.buttons.get("KeyA")!;
    assert.equal(keyState.wasJustAutoRepeated, true);
  });

  test("should capture character input", () => {
    mockedDocumentAdapter.dispatchKeyboardEvent("keypress", {
      key: "a"
    });

    keyboard.update();
    assert.equal(keyboard.char, "a");
  });

  test("should reset state correctly", () => {
    mockedDocumentAdapter.dispatchKeyboardEvent("keydown", { code: "KeyA" });
    keyboard.update();
    keyboard.reset();

    assert.equal(keyboard.buttons.size, 0);
    assert.equal(keyboard.buttonsDown.size, 0);
    assert.equal(keyboard.char, "");
    assert.equal(keyboard.autoRepeatedCode, null);
  });

  test("should handle multiple keys pressed simultaneously", () => {
    mockedDocumentAdapter.dispatchKeyboardEvent("keydown", { code: "KeyA" });
    mockedDocumentAdapter.dispatchKeyboardEvent("keydown", { code: "KeyB" });
    keyboard.update();

    const keyStateA = keyboard.buttons.get("KeyA")!;
    const keyStateB = keyboard.buttons.get("KeyB")!;

    assert.equal(keyStateA.isDown, true);
    assert.equal(keyStateB.isDown, true);
    assert.equal(keyboard.buttonsDown.size, 2);
  });

  test("should clear wasJustPressed after update cycle", () => {
    mockedDocumentAdapter.dispatchKeyboardEvent("keydown", { code: "KeyA" });
    keyboard.update();

    const keyStateFirstUpdate = keyboard.buttons.get("KeyA")!;
    assert.equal(keyStateFirstUpdate.wasJustPressed, true);

    keyboard.update();

    const keyStateSecondUpdate = keyboard.buttons.get("KeyA")!;
    assert.equal(keyStateSecondUpdate.wasJustPressed, false);
    assert.equal(keyStateSecondUpdate.isDown, true);
  });

  test("should clear wasJustReleased after update cycle", () => {
    mockedDocumentAdapter.dispatchKeyboardEvent("keydown", { code: "KeyA" });
    keyboard.update();

    mockedDocumentAdapter.dispatchKeyboardEvent("keyup", { code: "KeyA" });
    keyboard.update();

    const keyStateFirstUpdate = keyboard.buttons.get("KeyA")!;
    assert.equal(keyStateFirstUpdate.wasJustReleased, true);

    keyboard.update();

    const keyStateSecondUpdate = keyboard.buttons.get("KeyA")!;
    assert.equal(keyStateSecondUpdate.wasJustReleased, false);
  });

  test("should clear wasJustAutoRepeated after update cycle", () => {
    mockedDocumentAdapter.dispatchKeyboardEvent("keydown", { code: "KeyA" });
    keyboard.update();

    mockedDocumentAdapter.dispatchKeyboardEvent("keydown", { code: "KeyA" });
    keyboard.update();

    const keyStateFirstUpdate = keyboard.buttons.get("KeyA")!;
    assert.equal(keyStateFirstUpdate.wasJustAutoRepeated, true);

    keyboard.update();

    const keyStateSecondUpdate = keyboard.buttons.get("KeyA")!;
    assert.equal(keyStateSecondUpdate.wasJustAutoRepeated, false);
  });

  test("should update newChar property", () => {
    mockedDocumentAdapter.dispatchKeyboardEvent("keypress", { key: "x" });

    assert.equal(keyboard.newChar, "x");

    keyboard.update();
    assert.equal(keyboard.char, "x");
    assert.equal(keyboard.newChar, "");
  });

  test("should handle keyup without prior keydown", () => {
    mockedDocumentAdapter.dispatchKeyboardEvent("keyup", { code: "KeyA" });
    keyboard.update();

    const keyState = keyboard.buttons.get("KeyA");
    assert.equal(keyState, undefined);
  });

  test("should maintain buttonsDown set correctly", () => {
    mockedDocumentAdapter.dispatchKeyboardEvent("keydown", { code: "KeyA" });
    keyboard.update();

    assert.equal(keyboard.buttonsDown.has("KeyA"), true);

    mockedDocumentAdapter.dispatchKeyboardEvent("keyup", { code: "KeyA" });
    keyboard.update();

    assert.equal(keyboard.buttonsDown.has("KeyA"), false);
  });
});

class MockEventTarget {
  #listeners = new Map<string, Set<(event: BrowserWindow["KeyboardEvent"]) => void>>();

  addEventListener(
    type: string,
    listener: (event: BrowserWindow["KeyboardEvent"]) => void
  ) {
    if (!this.#listeners.has(type)) {
      this.#listeners.set(type, new Set());
    }
    this.#listeners.get(type)!.add(listener);
  }

  removeEventListener(
    type: string,
    listener: (event: BrowserWindow["KeyboardEvent"]) => void
  ) {
    this.#listeners.get(type)?.delete(listener);
  }

  dispatchKeyboardEvent(type: string, eventData: {
    code?: string;
    key?: string;
  }) {
    const event = new kWindow.KeyboardEvent(type, {
      code: eventData.code || "",
      key: eventData.key || "",
      bubbles: true,
      cancelable: true
    });

    const listeners = this.#listeners.get(type) ?? [];
    // @ts-expect-error
    listeners.forEach((listener) => listener(event));
  }
}
