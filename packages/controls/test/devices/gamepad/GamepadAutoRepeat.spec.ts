// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach,
  mock
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { Gamepad } from "../../../src/index.ts";
import * as mocks from "../../mocks/index.ts";
import { createGamepadFixture } from "./Gamepad.fixture.ts";

describe("Controls.Gamepad auto repeat", () => {
  let gamepad: Gamepad;
  let navigatorAdapter: mocks.NavigatorAdapter;

  beforeEach(() => {
    ({
      gamepad,
      navigatorAdapter
    } = createGamepadFixture());
  });

  test("should create auto repeat when axis is pressed", () => {
    const mockGamepad = mocks.Gamepad();
    mockGamepad.axes[0] = 0.8;
    mockGamepad.axes[1] = 0.0;
    navigatorAdapter.gamepads = [mockGamepad, null, null, null];

    gamepad.update();

    const autoRepeat = gamepad.autoRepeats[0];
    assert.ok(autoRepeat !== null);
    assert.strictEqual(autoRepeat.axis, 0);
    assert.strictEqual(autoRepeat.positive, true);
    assert.ok(autoRepeat.time > Date.now());
  });

  test("should trigger auto repeat after delay", () => {
    const originalDateNow = Date.now;
    let mockTime = 1000;

    // Mock Date.now to control time
    Date.now = mock.fn(() => mockTime);

    const mockGamepad = mocks.Gamepad();
    mockGamepad.axes[0] = 0.8;
    mockGamepad.axes[1] = 0.0;
    navigatorAdapter.gamepads = [mockGamepad, null, null, null];

    // First update creates auto repeat
    gamepad.update();

    // Advance time past the auto repeat delay
    // 600ms later (delay is 500ms)
    mockTime = 1600;

    // Second update should trigger auto repeat
    gamepad.update();

    const xAxis = gamepad.axes[0][0];
    assert.strictEqual(xAxis.wasPositiveJustAutoRepeated, true);

    // Restore original Date.now
    Date.now = originalDateNow;
  });

  test("should cancel auto repeat when axis is released", () => {
    const mockGamepad = mocks.Gamepad();
    mockGamepad.axes[0] = 0.8;
    mockGamepad.axes[1] = 0.0;
    navigatorAdapter.gamepads = [mockGamepad, null, null, null];

    // First update to create auto repeat
    gamepad.update();

    // Release axis
    mockGamepad.axes[0] = 0.0;
    gamepad.update();

    const autoRepeat = gamepad.autoRepeats[0];
    assert.strictEqual(autoRepeat, null);
  });

  test("should handle multiple gamepads", () => {
    const mockGamepad1 = mocks.Gamepad();
    const mockGamepad2 = mocks.Gamepad();

    mockGamepad1.buttons[0] = { pressed: true, value: 1.0 };
    mockGamepad2.buttons[1] = { pressed: true, value: 0.8 };

    navigatorAdapter.gamepads = [mockGamepad1, mockGamepad2, null, null];

    gamepad.update();

    // Check first gamepad
    const button1 = gamepad.buttons[0][0];
    assert.strictEqual(button1.isDown, true);
    assert.strictEqual(button1.value, 1.0);

    // Check second gamepad
    const button2 = gamepad.buttons[1][1];
    assert.strictEqual(button2.isDown, true);
    assert.strictEqual(button2.value, 0.8);
  });

  test("should handle second stick axes correctly", () => {
    const mockGamepad = mocks.Gamepad();
    // Second stick (axes 2 and 3)
    mockGamepad.axes[2] = 0.7;
    mockGamepad.axes[3] = -0.5;
    navigatorAdapter.gamepads = [mockGamepad, null, null, null];

    gamepad.update();

    const xAxis = gamepad.axes[0][2];
    const yAxis = gamepad.axes[0][3];

    assert.strictEqual(xAxis.value, 0.7);
    assert.strictEqual(yAxis.value, -0.5);
    assert.strictEqual(xAxis.wasPositiveJustPressed, true);
    assert.strictEqual(yAxis.wasNegativeJustPressed, false);
  });

  test("should prioritize first axis for auto repeat when both are pressed", () => {
    const mockGamepad = mocks.Gamepad();
    mockGamepad.axes[0] = 0.8;
    mockGamepad.axes[1] = 0.6;
    navigatorAdapter.gamepads = [mockGamepad, null, null, null];

    gamepad.update();

    const autoRepeat = gamepad.autoRepeats[0];
    assert.ok(autoRepeat !== null);
    // Should prioritize first axis (index 0)
    assert.strictEqual(autoRepeat.axis, 0);
  });
});
