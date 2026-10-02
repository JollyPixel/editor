// Import Node.js Dependencies
import {
  beforeEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { Gamepad } from "../../../src/index.ts";
import * as mocks from "../../mocks/index.ts";
import { createGamepadFixture } from "./Gamepad.fixture.ts";

describe("Controls.Gamepad frame sampling", () => {
  let gamepad: Gamepad;
  let device: mocks.GamepadMock;

  beforeEach(() => {
    let navigatorAdapter: mocks.NavigatorAdapter;
    ({
      gamepad,
      navigatorAdapter
    } = createGamepadFixture());
    device = mocks.Gamepad();
    navigatorAdapter.gamepads = [device, null, null, null];
  });

  test("a button press sampled on a frame without a step reaches the next step once", () => {
    device.buttons[0] = { pressed: true, value: 1 };

    gamepad.sample();
    gamepad.publish("frame");
    assert.strictEqual(gamepad.wasButtonJustPressed(0, "A"), true);

    gamepad.update();
    assert.strictEqual(gamepad.wasButtonJustPressed(0, "A"), true);

    gamepad.publish("frame");
    assert.strictEqual(gamepad.wasButtonJustPressed(0, "A"), false);

    gamepad.update();
    assert.strictEqual(gamepad.wasButtonJustPressed(0, "A"), false);
    assert.strictEqual(gamepad.isButtonDown(0, "A"), true);
  });

  test("a stick push sampled on a frame without a step reaches the next step once", () => {
    function pushed(): boolean {
      return gamepad.wasAxisJustPressed(
        0,
        "LeftStickX",
        { positive: true }
      );
    }
    device.axes[0] = 1;

    gamepad.sample();
    gamepad.publish("frame");
    assert.strictEqual(pushed(), true);

    gamepad.update();
    assert.strictEqual(pushed(), true);

    gamepad.publish("frame");
    assert.strictEqual(pushed(), false);
  });
});
