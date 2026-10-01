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

describe("Controls.Keyboard suspend", () => {
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

  test("releases held keys and ignores keys while suspended", () => {
    documentAdapter.dispatchEvent("keydown", { code: "KeyW" });
    keyboard.update();

    keyboard.suspend();
    documentAdapter.dispatchEvent("keydown", { code: "KeyA" });
    keyboard.update();

    assert.equal(keyboard.suspended, true);
    assert.equal(keyboard.isDown("KeyW"), false);
    assert.equal(keyboard.isDown("KeyA"), false);
  });

  test("resumes once every suspension is released", () => {
    const releaseFirst = keyboard.suspend();
    const releaseSecond = keyboard.suspend();

    releaseFirst();
    releaseFirst();
    assert.equal(keyboard.suspended, true);

    releaseSecond();
    documentAdapter.dispatchEvent("keydown", { code: "KeyA" });
    keyboard.update();

    assert.equal(keyboard.suspended, false);
    assert.equal(keyboard.isDown("KeyA"), true);
  });

  test("leaves the enabled state untouched", () => {
    keyboard.enabled = false;
    keyboard.suspend()();

    assert.equal(keyboard.enabled, false);
  });
});
