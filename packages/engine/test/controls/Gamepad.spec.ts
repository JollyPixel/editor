// Import Node.js Dependencies
import { describe, test, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Gamepad } from "../../src/controls/targets/Gamepad.class.js";

describe("Controls.Gamepad", () => {
  let gamepad: Gamepad;
  let mockNavigatorAdapter: MockNavigatorAdapter;

  beforeEach(() => {
    mockNavigatorAdapter = new MockNavigatorAdapter();
    gamepad = new Gamepad({
      // @ts-expect-error
      navigatorAdapter: mockNavigatorAdapter
    });
  });

  test("should initialize with default values", () => {
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
    mockNavigatorAdapter.gamepads = null;

    assert.doesNotThrow(() => {
      gamepad.update();
    });
  });

  test("should update button states when button is pressed", () => {
    const mockGamepad = createMockGamepad();
    mockGamepad.buttons[0] = { pressed: true, value: 1.0 };
    mockNavigatorAdapter.gamepads = [mockGamepad, null, null, null];

    gamepad.update();

    const button = gamepad.buttons[0][0];
    assert.strictEqual(button.isDown, true);
    assert.strictEqual(button.wasJustPressed, true);
    assert.strictEqual(button.wasJustReleased, false);
    assert.strictEqual(button.value, 1.0);
  });

  test("should update button states when button is released", () => {
    const mockGamepad = createMockGamepad();
    mockGamepad.buttons[0] = { pressed: true, value: 1.0 };
    mockNavigatorAdapter.gamepads = [mockGamepad, null, null, null];

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
    const mockGamepad = createMockGamepad();
    mockGamepad.buttons[0] = null;
    mockNavigatorAdapter.gamepads = [mockGamepad, null, null, null];

    assert.doesNotThrow(() => {
      gamepad.update();
    });

    const button = gamepad.buttons[0][0];
    assert.strictEqual(button.isDown, false);
    assert.strictEqual(button.value, 0);
  });

  test("should update axis values when stick is moved beyond dead zone", () => {
    const mockGamepad = createMockGamepad();
    mockGamepad.axes[0] = 0.8;
    mockGamepad.axes[1] = 0.6;
    mockNavigatorAdapter.gamepads = [mockGamepad, null, null, null];

    gamepad.update();

    const xAxis = gamepad.axes[0][0];
    const yAxis = gamepad.axes[0][1];

    assert.strictEqual(xAxis.value, 0.8);
    assert.strictEqual(yAxis.value, 0.6);
    assert.strictEqual(xAxis.wasPositiveJustPressed, true);
    assert.strictEqual(yAxis.wasPositiveJustPressed, true);
  });

  test("should apply dead zone to axis values", () => {
    const mockGamepad = createMockGamepad();
    // Small movement within dead zone
    mockGamepad.axes[0] = 0.1;
    mockGamepad.axes[1] = 0.1;
    mockNavigatorAdapter.gamepads = [mockGamepad, null, null, null];

    gamepad.update();

    const xAxis = gamepad.axes[0][0];
    const yAxis = gamepad.axes[0][1];

    assert.strictEqual(xAxis.value, 0);
    assert.strictEqual(yAxis.value, 0);
    assert.strictEqual(xAxis.wasPositiveJustPressed, false);
    assert.strictEqual(yAxis.wasPositiveJustPressed, false);
  });

  test("should handle negative axis values", () => {
    const mockGamepad = createMockGamepad();
    mockGamepad.axes[0] = -0.8;
    mockGamepad.axes[1] = -0.6;
    mockNavigatorAdapter.gamepads = [mockGamepad, null, null, null];

    gamepad.update();

    const xAxis = gamepad.axes[0][0];
    const yAxis = gamepad.axes[0][1];

    assert.strictEqual(xAxis.value, -0.8);
    assert.strictEqual(yAxis.value, -0.6);
    assert.strictEqual(xAxis.wasNegativeJustPressed, true);
    assert.strictEqual(yAxis.wasNegativeJustPressed, true);
  });

  test("should detect axis release", () => {
    const mockGamepad = createMockGamepad();
    mockGamepad.axes[0] = 0.8;
    mockGamepad.axes[1] = 0.0;
    mockNavigatorAdapter.gamepads = [mockGamepad, null, null, null];

    // First update to press axis
    gamepad.update();

    // Second update to release axis
    mockGamepad.axes[0] = 0.0;
    gamepad.update();

    const xAxis = gamepad.axes[0][0];

    assert.strictEqual(xAxis.value, 0);
    assert.strictEqual(xAxis.wasPositiveJustReleased, true);
    assert.strictEqual(xAxis.wasPositiveJustPressed, false);
  });

  test("should skip axes when null", () => {
    const mockGamepad = createMockGamepad();
    mockGamepad.axes[0] = null;
    mockGamepad.axes[1] = null;
    mockNavigatorAdapter.gamepads = [mockGamepad, null, null, null];

    assert.doesNotThrow(() => {
      gamepad.update();
    });

    const xAxis = gamepad.axes[0][0];
    const yAxis = gamepad.axes[0][1];

    assert.strictEqual(xAxis.value, 0);
    assert.strictEqual(yAxis.value, 0);
  });

  test("should create auto repeat when axis is pressed", () => {
    const mockGamepad = createMockGamepad();
    mockGamepad.axes[0] = 0.8;
    mockGamepad.axes[1] = 0.0;
    mockNavigatorAdapter.gamepads = [mockGamepad, null, null, null];

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

    const mockGamepad = createMockGamepad();
    mockGamepad.axes[0] = 0.8;
    mockGamepad.axes[1] = 0.0;
    mockNavigatorAdapter.gamepads = [mockGamepad, null, null, null];

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
    const mockGamepad = createMockGamepad();
    mockGamepad.axes[0] = 0.8;
    mockGamepad.axes[1] = 0.0;
    mockNavigatorAdapter.gamepads = [mockGamepad, null, null, null];

    // First update to create auto repeat
    gamepad.update();

    // Release axis
    mockGamepad.axes[0] = 0.0;
    gamepad.update();

    const autoRepeat = gamepad.autoRepeats[0];
    assert.strictEqual(autoRepeat, null);
  });

  test("should handle multiple gamepads", () => {
    const mockGamepad1 = createMockGamepad();
    const mockGamepad2 = createMockGamepad();

    mockGamepad1.buttons[0] = { pressed: true, value: 1.0 };
    mockGamepad2.buttons[1] = { pressed: true, value: 0.8 };

    mockNavigatorAdapter.gamepads = [mockGamepad1, mockGamepad2, null, null];

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
    const mockGamepad = createMockGamepad();
    // Second stick (axes 2 and 3)
    mockGamepad.axes[2] = 0.7;
    mockGamepad.axes[3] = -0.5;
    mockNavigatorAdapter.gamepads = [mockGamepad, null, null, null];

    gamepad.update();

    const xAxis = gamepad.axes[0][2];
    const yAxis = gamepad.axes[0][3];

    assert.strictEqual(xAxis.value, 0.7);
    assert.strictEqual(yAxis.value, -0.5);
    assert.strictEqual(xAxis.wasPositiveJustPressed, true);
    assert.strictEqual(yAxis.wasNegativeJustPressed, false);
  });

  test("should prioritize first axis for auto repeat when both are pressed", () => {
    const mockGamepad = createMockGamepad();
    mockGamepad.axes[0] = 0.8;
    mockGamepad.axes[1] = 0.6;
    mockNavigatorAdapter.gamepads = [mockGamepad, null, null, null];

    gamepad.update();

    const autoRepeat = gamepad.autoRepeats[0];
    assert.ok(autoRepeat !== null);
    // Should prioritize first axis (index 0)
    assert.strictEqual(autoRepeat.axis, 0);
  });
});

function createMockGamepad(): any {
  return {
    id: "mock-gamepad",
    index: 0,
    connected: true,
    timestamp: Date.now(),
    mapping: "standard",
    buttons: Array.from({ length: 16 }, () => {
      return { pressed: false, value: 0 };
    }),
    axes: Array.from({ length: 4 }, () => 0),
    hapticActuators: []
  };
}

class MockNavigatorAdapter {
  gamepads: any = [null, null, null, null];

  getGamepads(): (globalThis.Gamepad | null)[] | null {
    return this.gamepads;
  }
}
