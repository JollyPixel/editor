// Import Node.js Dependencies
import {
  afterEach,
  beforeEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { Keyboard } from "../../../src/index.ts";
import {
  createConnectedKeyboardFixture,
  type KeyboardDocumentAdapter
} from "./Keyboard.fixture.ts";

describe("Controls.Keyboard frame sampling", () => {
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

  test("a press sampled on a frame without a step reaches the next step once", () => {
    documentAdapter.dispatchEvent("keydown", { code: "Space" });

    keyboard.sample();
    keyboard.publish("frame");
    assert.strictEqual(keyboard.wasJustPressed("Space"), true);

    keyboard.update();
    assert.strictEqual(keyboard.wasJustPressed("Space"), true);

    keyboard.publish("frame");
    assert.strictEqual(keyboard.wasJustPressed("Space"), false);

    keyboard.update();
    assert.strictEqual(keyboard.wasJustPressed("Space"), false);
    assert.strictEqual(keyboard.isDown("Space"), true);
  });

  test("pending edges survive several frames without a step", () => {
    documentAdapter.dispatchEvent("keydown", { code: "Space" });
    keyboard.sample();
    keyboard.publish("frame");
    keyboard.sample();
    keyboard.publish("frame");

    assert.strictEqual(keyboard.wasJustPressed("Space"), false);

    keyboard.update();

    assert.strictEqual(keyboard.wasJustPressed("Space"), true);
  });

  test("a tap between two steps reports both edges to the step", () => {
    documentAdapter.dispatchEvent("keydown", { code: "Space" });
    keyboard.sample();
    documentAdapter.dispatchEvent("keyup", { code: "Space" });

    keyboard.update();

    assert.strictEqual(keyboard.wasJustPressed("Space"), true);
    assert.strictEqual(keyboard.wasJustReleased("Space"), true);
    assert.strictEqual(keyboard.isDown("Space"), false);
  });

  test("the published frame shows edges from every step since the last frame", () => {
    documentAdapter.dispatchEvent("keydown", { code: "Space" });
    keyboard.update();
    keyboard.update();
    assert.strictEqual(keyboard.wasJustPressed("Space"), false);

    keyboard.publish("frame");

    assert.strictEqual(keyboard.wasJustPressed("Space"), true);
  });

  test("typed characters reach the frame and the next step once each", () => {
    documentAdapter.dispatchEvent("keypress", { key: "a" });

    keyboard.sample();
    keyboard.publish("frame");
    assert.strictEqual(keyboard.char, "a");

    keyboard.update();
    assert.strictEqual(keyboard.char, "a");

    keyboard.publish("frame");
    assert.strictEqual(keyboard.char, "");
  });

  test("reset() drops pending edges", () => {
    documentAdapter.dispatchEvent("keydown", { code: "Space" });
    keyboard.sample();

    keyboard.reset();
    keyboard.update();

    assert.strictEqual(keyboard.wasJustPressed("Space"), false);
  });
});
