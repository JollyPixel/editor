// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  Input,
  MouseEventButton,
  GamepadButton
} from "../src/index.ts";
import { AtomicInput } from "../src/AtomicInput.ts";
import * as mocks from "./mocks/index.ts";

describe("Controls.AtomicInput", () => {
  let canvas: mocks.CanvasAdapter;
  let input: Input;

  beforeEach(() => {
    canvas = new mocks.CanvasAdapter();
    input = new Input(canvas, {
      documentAdapter: new mocks.DocumentAdapter()
    });
    // Mouse state now lives in private bitmasks, so it is driven through the
    // DOM handlers rather than written directly.
    input.mouse.connect();
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
        code: "KeyA",
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

      canvas.dispatch("mousedown", { button: MouseEventButton.left, preventDefault: () => void 0 });
      input.mouse.update();

      assert.strictEqual(down.evaluate(input), true);
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
