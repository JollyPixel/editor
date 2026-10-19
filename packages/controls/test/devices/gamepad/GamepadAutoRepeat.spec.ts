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

describe("Controls.Gamepad auto repeat", () => {
  let gamepad: Gamepad;
  let pad: mocks.GamepadMock;

  function repeated(
    axis: number,
    positive = true
  ): boolean {
    return gamepad.wasAxisJustPressed(0, axis, { positive, autoRepeat: true }) &&
      !gamepad.wasAxisJustPressed(0, axis, { positive });
  }

  beforeEach(() => {
    const fixture = createGamepadFixture();
    gamepad = fixture.gamepad;
    pad = fixture.plug();
  });

  test("repeats a held direction after the delay, then at the rate", (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 1000 });
    pad.axes = [0.8, 0, 0, 0];
    gamepad.update();

    t.mock.timers.tick(499);
    gamepad.update();
    assert.strictEqual(repeated(0), false);

    t.mock.timers.tick(1);
    gamepad.update();
    assert.strictEqual(repeated(0), true);

    t.mock.timers.tick(10);
    gamepad.update();
    assert.strictEqual(repeated(0), false);

    t.mock.timers.tick(23);
    gamepad.update();
    assert.strictEqual(repeated(0), true);
  });

  test("reports a repeat only when asked for one", (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 1000 });
    pad.axes = [0.8, 0, 0, 0];
    gamepad.update();

    t.mock.timers.tick(500);
    gamepad.update();

    assert.strictEqual(gamepad.wasAxisJustPressed(0, 0, { positive: true }), false);
  });

  test("releasing the direction restarts the delay", (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 1000 });
    pad.axes = [0.8, 0, 0, 0];
    gamepad.update();
    t.mock.timers.tick(400);
    pad.axes = [0, 0, 0, 0];
    gamepad.update();

    pad.axes = [0.8, 0, 0, 0];
    gamepad.update();
    t.mock.timers.tick(400);
    gamepad.update();

    assert.strictEqual(repeated(0), false);
  });

  test("the first direction pressed in a poll owns the repeat", (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 1000 });
    pad.axes = [0.8, 0.6, 0, 0];
    gamepad.update();

    t.mock.timers.tick(500);
    gamepad.update();

    assert.strictEqual(repeated(0), true);
    assert.strictEqual(repeated(1), false);
  });
});
