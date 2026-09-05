// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Gamepad } from "../../../src/index.ts";
import * as mocks from "../../mocks/index.ts";
import { createGamepadFixture } from "./Gamepad.fixture.ts";

describe("Controls.Gamepad polling", () => {
  let gamepad: Gamepad;
  let navigatorAdapter: mocks.NavigatorAdapter;

  beforeEach(() => {
    ({
      gamepad,
      navigatorAdapter
    } = createGamepadFixture());
  });

  describe("vibration", () => {
    test("should initialize with no actuator", () => {
      assert.strictEqual(gamepad.vibration.length, 4);
      assert.strictEqual(gamepad.vibration[0].canVibrate, false);
    });

    test("should pick up the actuator from a connected gamepad on update", () => {
      const actuator = mocks.GamepadHapticActuator();
      const mockGamepad = mocks.Gamepad();
      mockGamepad.vibrationActuator = actuator;
      navigatorAdapter.gamepads = [mockGamepad, null, null, null];

      gamepad.update();

      assert.strictEqual(gamepad.vibration[0].canVibrate, true);
      assert.strictEqual(gamepad.vibration[1].canVibrate, false);
    });

    test("should leave canVibrate false when the gamepad has no actuator", () => {
      const mockGamepad = mocks.Gamepad();
      navigatorAdapter.gamepads = [mockGamepad, null, null, null];

      gamepad.update();

      assert.strictEqual(gamepad.vibration[0].canVibrate, false);
    });
  });

  describe("idle polling", () => {
    test("stops calling getGamepads() every frame while nothing is connected", () => {
      let polls = 0;
      navigatorAdapter.getGamepads = () => {
        polls++;

        return navigatorAdapter.toNativeGamepads();
      };

      for (let frame = 0; frame < 120; frame++) {
        gamepad.update();
      }

      // Roughly 120 / IdlePollFrames, versus 120 before the back-off.
      assert.ok(polls <= 8, `expected at most 8 polls, got ${polls}`);
    });

    test("polls every frame again as soon as a gamepad appears", () => {
      let polls = 0;
      navigatorAdapter.getGamepads = () => {
        polls++;

        return navigatorAdapter.toNativeGamepads();
      };

      navigatorAdapter.gamepads = [mocks.Gamepad(), null, null, null];
      for (let frame = 0; frame < 10; frame++) {
        gamepad.update();
      }

      assert.strictEqual(polls, 10);
    });

    test("observes a button release on the very next frame", () => {
      const mockGamepad = mocks.Gamepad();
      mockGamepad.buttons[0] = { pressed: true, value: 1 };
      navigatorAdapter.gamepads = [mockGamepad, null, null, null];
      gamepad.update();

      mockGamepad.buttons[0] = { pressed: false, value: 0 };
      gamepad.update();

      assert.strictEqual(gamepad.buttons[0][0].wasJustReleased, true);
    });

    test("clears wasActive when getGamepads() returns null", () => {
      const mockGamepad = mocks.Gamepad();
      mockGamepad.buttons[0] = { pressed: true, value: 1 };
      navigatorAdapter.gamepads = [mockGamepad, null, null, null];
      gamepad.update();
      assert.strictEqual(gamepad.wasActive, true);

      navigatorAdapter.getGamepads = () => null as any;
      gamepad.update();

      assert.strictEqual(gamepad.wasActive, false);
    });
  });

  describe("connection counting", () => {
    test("never drops below zero on an unmatched disconnect", () => {
      const windowAdapter = new mocks.WindowAdapter();
      const device = new Gamepad({ navigatorAdapter, windowAdapter });
      device.connect();

      windowAdapter.dispatch("gamepaddisconnected", { gamepad: mocks.Gamepad() });
      windowAdapter.dispatch("gamepaddisconnected", { gamepad: mocks.Gamepad() });

      assert.strictEqual(device.connectedGamepads, 0);
    });

    test("a disconnect after a connect returns the count to zero", () => {
      const windowAdapter = new mocks.WindowAdapter();
      const device = new Gamepad({ navigatorAdapter, windowAdapter });
      device.connect();

      windowAdapter.dispatch("gamepadconnected", { gamepad: mocks.Gamepad() });
      assert.strictEqual(device.connectedGamepads, 1);

      windowAdapter.dispatch("gamepaddisconnected", { gamepad: mocks.Gamepad() });
      assert.strictEqual(device.connectedGamepads, 0);
    });
  });
});
