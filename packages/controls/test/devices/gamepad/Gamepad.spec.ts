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

describe("Controls.Gamepad buttons", () => {
  let gamepad: Gamepad;
  let navigatorAdapter: mocks.NavigatorAdapter;

  beforeEach(() => {
    ({
      gamepad,
      navigatorAdapter
    } = createGamepadFixture());
  });

  test("should initialize with default values", () => {
    assert.strictEqual(gamepad.wasActive, false);
    assert.strictEqual(gamepad.buttons.length, 4);
    assert.strictEqual(gamepad.axes.length, 4);
    assert.strictEqual(gamepad.autoRepeats.length, 4);
    assert.strictEqual(gamepad.axisDeadZone, 0.25);
    assert.strictEqual(gamepad.axisAutoRepeatDelayMs, 500);
    assert.strictEqual(gamepad.axisAutoRepeatRateMs, 33);
  });

  test("should reset all button and axis states", () => {
    // Modify some states first
    gamepad.buttons[0][0].isDown = true;
    gamepad.axes[0][0].value = 0.8;

    gamepad.reset();

    // Check all buttons are reset
    for (let gamepadIndex = 0; gamepadIndex < 4; gamepadIndex++) {
      for (let buttonIndex = 0; buttonIndex < 16; buttonIndex++) {
        const button = gamepad.buttons[gamepadIndex][buttonIndex];
        assert.strictEqual(button.isDown, false);
        assert.strictEqual(button.wasJustPressed, false);
        assert.strictEqual(button.wasJustReleased, false);
        assert.strictEqual(button.value, 0);
      }
    }

    // Check all axes are reset
    for (let gamepadIndex = 0; gamepadIndex < 4; gamepadIndex++) {
      for (let axisIndex = 0; axisIndex < 4; axisIndex++) {
        const axis = gamepad.axes[gamepadIndex][axisIndex];
        assert.strictEqual(axis.wasPositiveJustPressed, false);
        assert.strictEqual(axis.wasPositiveJustAutoRepeated, false);
        assert.strictEqual(axis.wasPositiveJustReleased, false);
        assert.strictEqual(axis.wasNegativeJustPressed, false);
        assert.strictEqual(axis.wasNegativeJustAutoRepeated, false);
        assert.strictEqual(axis.wasNegativeJustReleased, false);
        assert.strictEqual(axis.value, 0);
      }
    }
  });

  test("should handle no gamepads available", () => {
    navigatorAdapter.gamepads = [];

    assert.doesNotThrow(() => {
      gamepad.update();
    });
  });

  test("should update button states when button is pressed", () => {
    const mockGamepad = mocks.Gamepad();
    mockGamepad.buttons[0] = { pressed: true, value: 1.0 };
    navigatorAdapter.gamepads = [mockGamepad, null, null, null];

    gamepad.update();
    assert.strictEqual(gamepad.wasActive, true);

    const button = gamepad.buttons[0][0];
    assert.strictEqual(button.isDown, true);
    assert.strictEqual(button.wasJustPressed, true);
    assert.strictEqual(button.wasJustReleased, false);
    assert.strictEqual(button.value, 1.0);
  });

  test("should update button states when button is released", () => {
    const mockGamepad = mocks.Gamepad();
    mockGamepad.buttons[0] = { pressed: true, value: 1.0 };
    navigatorAdapter.gamepads = [mockGamepad, null, null, null];

    // First update to press the button
    gamepad.update();

    // Second update to release the button
    mockGamepad.buttons[0] = { pressed: false, value: 0.0 };
    gamepad.update();

    const button = gamepad.buttons[0][0];
    assert.strictEqual(button.isDown, false);
    assert.strictEqual(button.wasJustPressed, false);
    assert.strictEqual(button.wasJustReleased, true);
    assert.strictEqual(button.value, 0.0);
  });

  test("should skip null buttons", () => {
    const mockGamepad = mocks.Gamepad();
    mockGamepad.buttons[0] = null;
    navigatorAdapter.gamepads = [mockGamepad, null, null, null];

    assert.doesNotThrow(() => {
      gamepad.update();
    });

    const button = gamepad.buttons[0][0];
    assert.strictEqual(button.isDown, false);
    assert.strictEqual(button.value, 0);
  });
});
