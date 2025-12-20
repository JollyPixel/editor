// Import Node.js Dependencies
import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import { Keyboard, type KeyCode } from "../../src/controls/devices/index.ts";
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
});

interface EventData {
  code?: KeyCode;
  key?: string;
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

    const listeners = this.listeners.get(type) ?? [];
    listeners.forEach((listener) => listener(event));
  }
}
