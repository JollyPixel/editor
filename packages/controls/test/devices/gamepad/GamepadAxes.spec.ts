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

describe("Controls.Gamepad axes", () => {
  let gamepad: Gamepad;
  let navigatorAdapter: mocks.NavigatorAdapter;

  beforeEach(() => {
    ({
      gamepad,
      navigatorAdapter
    } = createGamepadFixture());
  });

  test("should update axis values when stick is moved beyond dead zone", () => {
    const mockGamepad = mocks.Gamepad();
    mockGamepad.axes[0] = 0.8;
    mockGamepad.axes[1] = 0.6;
    navigatorAdapter.gamepads = [mockGamepad, null, null, null];

    gamepad.update();

    const xAxis = gamepad.axes[0][0];
    const yAxis = gamepad.axes[0][1];

    assert.strictEqual(xAxis.value, 0.8);
    assert.strictEqual(yAxis.value, 0.6);
    assert.strictEqual(xAxis.wasPositiveJustPressed, true);
    assert.strictEqual(yAxis.wasPositiveJustPressed, true);
  });

  test("should apply dead zone to axis values", () => {
    const mockGamepad = mocks.Gamepad();
    // Small movement within dead zone
    mockGamepad.axes[0] = 0.1;
    mockGamepad.axes[1] = 0.1;
    navigatorAdapter.gamepads = [mockGamepad, null, null, null];

    gamepad.update();

    const xAxis = gamepad.axes[0][0];
    const yAxis = gamepad.axes[0][1];

    assert.strictEqual(xAxis.value, 0);
    assert.strictEqual(yAxis.value, 0);
    assert.strictEqual(xAxis.wasPositiveJustPressed, false);
    assert.strictEqual(yAxis.wasPositiveJustPressed, false);
  });

  test("should handle negative axis values", () => {
    const mockGamepad = mocks.Gamepad();
    mockGamepad.axes[0] = -0.8;
    mockGamepad.axes[1] = -0.6;
    navigatorAdapter.gamepads = [mockGamepad, null, null, null];

    gamepad.update();

    const xAxis = gamepad.axes[0][0];
    const yAxis = gamepad.axes[0][1];

    assert.strictEqual(xAxis.value, -0.8);
    assert.strictEqual(yAxis.value, -0.6);
    assert.strictEqual(xAxis.wasNegativeJustPressed, true);
    assert.strictEqual(yAxis.wasNegativeJustPressed, true);
  });

  test("should detect axis release", () => {
    const mockGamepad = mocks.Gamepad();
    mockGamepad.axes[0] = 0.8;
    mockGamepad.axes[1] = 0.0;
    navigatorAdapter.gamepads = [mockGamepad, null, null, null];

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
    const mockGamepad = mocks.Gamepad();
    mockGamepad.axes[0] = null;
    mockGamepad.axes[1] = null;
    navigatorAdapter.gamepads = [mockGamepad, null, null, null];

    assert.doesNotThrow(() => {
      gamepad.update();
    });

    const xAxis = gamepad.axes[0][0];
    const yAxis = gamepad.axes[0][1];

    assert.strictEqual(xAxis.value, 0);
    assert.strictEqual(yAxis.value, 0);
  });
});
