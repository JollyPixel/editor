// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach,
  afterEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { Keyboard } from "../../../src/index.ts";
import {
  createConnectedKeyboardFixture,
  type KeyboardDocumentAdapter
} from "./Keyboard.fixture.ts";

describe("Controls.Keyboard idle gating", () => {
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
