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

describe("Controls.Keyboard enabled", () => {
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
