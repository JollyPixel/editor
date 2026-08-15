// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach,
  mock
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  Input,
  MouseEventButton,
  GamepadButton
} from "../src/index.ts";
import { AtomicInput } from "../src/AtomicInput.ts";
import type { CanvasAdapter } from "../src/adapters/index.ts";

function createFakeCanvas(): CanvasAdapter {
  return {
    clientWidth: 800,
    clientHeight: 600,
    style: { cursor: "auto" },
    addEventListener: mock.fn(),
    removeEventListener: mock.fn(),
    requestFullscreen: mock.fn(() => Promise.resolve()),
    requestPointerLock: mock.fn(() => Promise.resolve()),
    focus: mock.fn()
  };
}

describe("Controls.AtomicInput", () => {
  let input: Input;

  beforeEach(() => {
    input = new Input(createFakeCanvas());
  });

  describe("key", () => {
    test("down / pressed / released delegate to the matching Input keyboard query", () => {
      const down = new AtomicInput("key", "KeyA", "down");
      const pressed = new AtomicInput("key", "KeyA", "pressed");
      const released = new AtomicInput("key", "KeyA", "released");

      assert.strictEqual(down.evaluate(input), false);

      input.keyboard.buttonsDown.add("KeyA");
      assert.strictEqual(down.evaluate(input), true);

      input.keyboard.buttons.set("KeyA", {
        isDown: true,
        wasJustPressed: true,
        wasJustAutoRepeated: false,
        wasJustReleased: false
      });
      assert.strictEqual(pressed.evaluate(input), true);
      assert.strictEqual(released.evaluate(input), false);
    });
  });

  describe("mouse", () => {
    test("down / pressed / released delegate to the matching Input mouse query", () => {
      const down = new AtomicInput("mouse", "left", "down");
      const pressed = new AtomicInput("mouse", "left", "pressed");

      assert.strictEqual(down.evaluate(input), false);

      input.mouse.buttonsDown[MouseEventButton.left] = true;
      assert.strictEqual(down.evaluate(input), true);

      input.mouse.buttons[MouseEventButton.left].wasJustPressed = true;
      assert.strictEqual(pressed.evaluate(input), true);
    });
  });

  describe("gamepad", () => {
    test("resolves a numeric button index", () => {
      const down = new AtomicInput("gamepad", [0, GamepadButton.A], "down");

      assert.strictEqual(down.evaluate(input), false);

      input.gamepad.buttons[0][GamepadButton.A].isDown = true;
      assert.strictEqual(down.evaluate(input), true);
    });

    test("resolves a named button through the GamepadButton enum", () => {
      const down = new AtomicInput("gamepad", [0, "A"], "down");

      input.gamepad.buttons[0][GamepadButton.A].isDown = true;
      assert.strictEqual(down.evaluate(input), true);
    });
  });

  describe("reset", () => {
    test("is a no-op (atomic inputs carry no state)", () => {
      const atomic = new AtomicInput("key", "KeyA", "down");

      assert.doesNotThrow(() => atomic.reset());
    });
  });
});
