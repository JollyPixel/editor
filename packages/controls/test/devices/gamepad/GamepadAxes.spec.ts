// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { Gamepad } from "../../../src/index.ts";
import type * as mocks from "../../mocks/index.ts";
import { createGamepadFixture } from "./Gamepad.fixture.ts";

describe("Controls.Gamepad axes", () => {
  let gamepad: Gamepad;
  let pad: mocks.GamepadMock;

  beforeEach(() => {
    const fixture = createGamepadFixture();
    gamepad = fixture.gamepad;
    pad = fixture.plug();
  });

  test("reports stick values beyond the dead zone", () => {
    pad.axes = [0.8, -0.6, 0.7, 0];
    gamepad.update();

    assert.strictEqual(gamepad.axisValue(0, "LeftStickX"), 0.8);
    assert.strictEqual(gamepad.axisValue(0, "LeftStickY"), -0.6);
    assert.strictEqual(gamepad.axisValue(0, "RightStickX"), 0.7);
  });

  test("zeroes both axes of a stick inside the dead zone", () => {
    pad.axes = [0.1, 0.1, 0, 0];
    gamepad.update();

    assert.strictEqual(gamepad.axisValue(0, 0), 0);
    assert.strictEqual(gamepad.axisValue(0, 1), 0);
    assert.strictEqual(gamepad.wasAxisJustPressed(0, 0, { positive: true }), false);
  });

  test("a push past half publishes a directional press then release", () => {
    pad.axes = [0.8, -0.6, 0, 0];
    gamepad.update();

    assert.strictEqual(gamepad.wasAxisJustPressed(0, 0, { positive: true }), true);
    assert.strictEqual(gamepad.wasAxisJustPressed(0, 0), false);
    assert.strictEqual(gamepad.wasAxisJustPressed(0, 1), true);
    assert.strictEqual(gamepad.wasActive, true);

    pad.axes = [0, 0, 0, 0];
    gamepad.update();

    assert.strictEqual(gamepad.wasAxisJustReleased(0, 0, { positive: true }), true);
    assert.strictEqual(gamepad.wasAxisJustReleased(0, 1), true);
    assert.strictEqual(gamepad.wasAxisJustPressed(0, 0, { positive: true }), false);
  });

  test("a value under half moves the stick without a press", () => {
    pad.axes = [0, 0, 0.7, -0.5];
    gamepad.update();

    assert.strictEqual(gamepad.wasAxisJustPressed(0, "RightStickX", { positive: true }), true);
    assert.strictEqual(gamepad.wasAxisJustPressed(0, "RightStickY"), false);
    assert.strictEqual(gamepad.axisValue(0, "RightStickY"), -0.5);
  });

  test("skips a stick without numeric axes", () => {
    pad.axes = [null, null];
    gamepad.update();

    assert.strictEqual(gamepad.axisValue(0, 0), 0);
    assert.strictEqual(gamepad.axisValue(0, 3), 0);
  });

  test("rejects an axis out of range", () => {
    assert.throws(() => gamepad.axisValue(0, 4), /Invalid gamepad info/);
    assert.throws(() => gamepad.wasAxisJustPressed(0, -1), /Invalid gamepad info/);
  });
});
