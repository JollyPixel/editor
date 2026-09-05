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
  type KeyboardDocumentAdapter,
  createElement
} from "./Keyboard.fixture.ts";

describe("Controls.Keyboard targets", () => {
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
});
