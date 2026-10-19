// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  MouseEventButton,
  GamepadButton
} from "../../../src/index.ts";
import { AtomicInput } from "../../../src/combination/conditions/index.ts";
import {
  createInputFixture,
  type InputFixture
} from "../../helpers/input.ts";

describe("Controls.AtomicInput", () => {
  let fixture: InputFixture;

  beforeEach(() => {
    fixture = createInputFixture();
  });

  test("key states follow the matching keyboard query", () => {
    const { input, press } = fixture;
    const down = new AtomicInput("key", "KeyA", "down");
    const pressed = new AtomicInput("key", "KeyA", "pressed");
    const released = new AtomicInput("key", "KeyA", "released");

    assert.strictEqual(down.evaluate(input), false);

    press("KeyA");
    input.update();

    assert.strictEqual(down.evaluate(input), true);
    assert.strictEqual(pressed.evaluate(input), true);
    assert.strictEqual(released.evaluate(input), false);
  });

  test("mouse states follow the matching mouse query", () => {
    const { input, canvas } = fixture;
    const down = new AtomicInput("mouse", "left", "down");
    const pressed = new AtomicInput("mouse", "left", "pressed");

    assert.strictEqual(down.evaluate(input), false);

    canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.left });
    input.update();

    assert.strictEqual(down.evaluate(input), true);
    assert.strictEqual(pressed.evaluate(input), true);
  });

  test("gamepad buttons resolve by index or by name", () => {
    const { input, plug } = fixture;
    const byIndex = new AtomicInput("gamepad", [0, GamepadButton.A], "down");
    const byName = new AtomicInput("gamepad", [0, "A"], "down");

    assert.strictEqual(byIndex.evaluate(input), false);

    plug().buttons[GamepadButton.A] = {
      pressed: true,
      value: 1
    };
    input.update();

    assert.strictEqual(byIndex.evaluate(input), true);
    assert.strictEqual(byName.evaluate(input), true);
  });
});
