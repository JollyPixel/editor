// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { Gamepad } from "../../../src/index.ts";
import * as mocks from "../../mocks/index.ts";
import { createGamepadFixture } from "./Gamepad.fixture.ts";

describe("Controls.Gamepad queries", () => {
  let gamepad: Gamepad;
  let navigatorAdapter: mocks.NavigatorAdapter;

  beforeEach(() => {
    ({
      gamepad,
      navigatorAdapter
    } = createGamepadFixture());
  });

  describe("button/axis queries", () => {
    test("isButtonDown / wasButtonJustPressed / wasButtonJustReleased / buttonValue resolve a named button", () => {
      gamepad.buttons[0][0] = {
        isDown: true,
        wasJustPressed: true,
        wasJustReleased: false,
        value: 0.75
      };

      assert.strictEqual(gamepad.isButtonDown(0, "A"), true);
      assert.strictEqual(gamepad.wasButtonJustPressed(0, "A"), true);
      assert.strictEqual(gamepad.wasButtonJustReleased(0, "A"), false);
      assert.strictEqual(gamepad.buttonValue(0, "A"), 0.75);
      assert.strictEqual(gamepad.isButtonDown(0, 0), true);
    });

    test("throws for an out-of-range button", () => {
      assert.throws(() => gamepad.isButtonDown(0, 999), /Invalid gamepad info/);
    });

    test("wasAxisJustPressed / wasAxisJustReleased / axisValue resolve a named axis", () => {
      gamepad.axes[0][0] = {
        wasPositiveJustPressed: true,
        wasPositiveJustAutoRepeated: false,
        wasPositiveJustReleased: false,
        wasNegativeJustPressed: false,
        wasNegativeJustAutoRepeated: false,
        wasNegativeJustReleased: false,
        value: 0.5
      };

      assert.strictEqual(gamepad.wasAxisJustPressed(0, "LeftStickX", { positive: true }), true);
      assert.strictEqual(gamepad.wasAxisJustReleased(0, "LeftStickX", { positive: true }), false);
      assert.strictEqual(gamepad.axisValue(0, "LeftStickX"), 0.5);
    });

    test("throws for an out-of-range axis", () => {
      assert.throws(() => gamepad.axisValue(0, 999), /Invalid gamepad info/);
    });
  });

  describe("controllers reporting fewer buttons/axes than the standard mapping", () => {
    test("does not throw when the gamepad exposes fewer buttons than MaxButtons", () => {
      const mockGamepad = mocks.Gamepad();
      mockGamepad.buttons = [{ pressed: true, value: 1 }, { pressed: false, value: 0 }];
      navigatorAdapter.gamepads = [mockGamepad, null, null, null];

      assert.doesNotThrow(() => gamepad.update());
      assert.strictEqual(gamepad.buttons[0][0].isDown, true);
      // Buttons the controller never reported stay at their reset state.
      assert.strictEqual(gamepad.buttons[0][5].isDown, false);
    });

    test("leaves axis values numeric when the gamepad exposes fewer axes than MaxAxes", () => {
      const mockGamepad = mocks.Gamepad();
      mockGamepad.axes = [0.9, -0.9];
      navigatorAdapter.gamepads = [mockGamepad, null, null, null];

      gamepad.update();

      assert.strictEqual(gamepad.axisValue(0, 0), 0.9);
      assert.strictEqual(gamepad.axisValue(0, 1), -0.9);
      // The absent second stick must not be poisoned with NaN/undefined.
      assert.strictEqual(gamepad.axisValue(0, 2), 0);
      assert.strictEqual(gamepad.axisValue(0, 3), 0);
    });
  });
});
