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

describe("Controls.Keyboard", () => {
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

  test("starts with nothing held and inactive", () => {
    assert.strictEqual(keyboard.wasActive, false);
    assert.strictEqual(keyboard.isDown("NONE"), true);
    assert.strictEqual(keyboard.isDown("ANY"), false);
  });

  test("a keydown holds the key under its code and its shorthand", () => {
    documentAdapter.dispatchEvent("keydown", { code: "KeyA" });

    assert.strictEqual(keyboard.isDown("A"), true);
    assert.strictEqual(keyboard.isDown("KeyA"), true);
    assert.strictEqual(keyboard.isDown("KeyB"), false);
    assert.strictEqual(keyboard.isDown("ANY"), true);
  });

  test("update() publishes press, auto-repeat, and release once each", () => {
    documentAdapter.dispatchEvent("keydown", { code: "KeyA" });
    keyboard.update();
    assert.strictEqual(keyboard.wasJustPressed("A"), true);
    assert.strictEqual(keyboard.wasActive, true);

    documentAdapter.dispatchEvent("keydown", { code: "KeyA" });
    keyboard.update();
    assert.strictEqual(keyboard.wasJustPressed("A"), false);
    assert.strictEqual(keyboard.wasJustAutoRepeated("A"), true);

    documentAdapter.dispatchEvent("keyup", { code: "KeyA" });
    keyboard.update();
    assert.strictEqual(keyboard.wasJustAutoRepeated("A"), false);
    assert.strictEqual(keyboard.wasJustReleased("A"), true);
    assert.strictEqual(keyboard.isDown("A"), false);

    keyboard.update();
    assert.strictEqual(keyboard.wasJustReleased("A"), false);
  });

  test("a tap between two updates reports the press and the release", () => {
    documentAdapter.dispatchEvent("keydown", { code: "Space" });
    documentAdapter.dispatchEvent("keyup", { code: "Space" });
    keyboard.update();

    assert.strictEqual(keyboard.wasJustPressed("Space"), true);
    assert.strictEqual(keyboard.wasJustReleased("Space"), true);
    assert.strictEqual(keyboard.isDown("Space"), false);
  });

  test("a keyup without a keydown reports nothing", () => {
    documentAdapter.dispatchEvent("keyup", { code: "KeyA" });
    keyboard.update();

    assert.strictEqual(keyboard.wasJustReleased("ANY"), false);
  });

  test("typed characters reach the frame and the next step once each", () => {
    documentAdapter.dispatchEvent("keypress", { key: "a" });
    documentAdapter.dispatchEvent("keypress", { key: "\r" });

    keyboard.sample();
    keyboard.publish("frame");
    assert.strictEqual(keyboard.char, "a");

    keyboard.update();
    assert.strictEqual(keyboard.char, "a");

    keyboard.publish("frame");
    assert.strictEqual(keyboard.char, "");
  });

  test("reset() drops held keys, pending edges, and typed characters", () => {
    documentAdapter.dispatchEvent("keydown", { code: "Space" });
    documentAdapter.dispatchEvent("keypress", { key: "a" });
    keyboard.sample();

    keyboard.reset();
    keyboard.update();

    assert.strictEqual(keyboard.isDown("Space"), false);
    assert.strictEqual(keyboard.wasJustPressed("Space"), false);
    assert.strictEqual(keyboard.char, "");
  });
});

describe("Controls.Keyboard preventControlKeys", () => {
  test("prevents control keys and Alt combos by default", () => {
    const { keyboard, documentAdapter } = createConnectedKeyboardFixture();

    assert.equal(documentAdapter.dispatchEvent("keydown", { code: "F5" }).defaultPrevented, true);
    assert.equal(
      documentAdapter.dispatchEvent("keydown", { code: "KeyF", altKey: true }).defaultPrevented,
      true
    );
    keyboard.disconnect();
  });

  test("leaves browser defaults alone when disabled", () => {
    const { keyboard, documentAdapter } = createConnectedKeyboardFixture({
      preventControlKeys: false
    });

    assert.equal(documentAdapter.dispatchEvent("keydown", { code: "F5" }).defaultPrevented, false);
    assert.equal(
      documentAdapter.dispatchEvent("keydown", { code: "KeyF", altKey: true }).defaultPrevented,
      false
    );
    assert.equal(keyboard.isDown("F5"), true);
    keyboard.disconnect();
  });
});
