// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  GamepadButton,
  type Gamepad
} from "../../../src/index.ts";
import * as mocks from "../../mocks/index.ts";
import { createGamepadFixture } from "./Gamepad.fixture.ts";

describe("Controls.Gamepad buttons", () => {
  let gamepad: Gamepad;
  let navigatorAdapter: mocks.NavigatorAdapter;
  let plug: (index?: number) => mocks.GamepadMock;

  beforeEach(() => {
    ({
      gamepad,
      navigatorAdapter,
      plug
    } = createGamepadFixture());
  });

  test("starts inactive with the default tuning", () => {
    assert.strictEqual(gamepad.wasActive, false);
    assert.strictEqual(gamepad.connectedGamepads, 0);
    assert.strictEqual(gamepad.axisDeadZone, 0.25);
    assert.strictEqual(gamepad.axisAutoRepeatDelayMs, 500);
    assert.strictEqual(gamepad.axisAutoRepeatRateMs, 33);
  });

  test("a polled press and release publish once each", () => {
    const pad = plug();
    pad.buttons[0] = { pressed: true, value: 0.75 };
    gamepad.update();

    assert.strictEqual(gamepad.wasActive, true);
    assert.strictEqual(gamepad.isButtonDown(0, "A"), true);
    assert.strictEqual(gamepad.isButtonDown(0, 0), true);
    assert.strictEqual(gamepad.wasButtonJustPressed(0, "A"), true);
    assert.strictEqual(gamepad.buttonValue(0, "A"), 0.75);

    gamepad.update();
    assert.strictEqual(gamepad.wasButtonJustPressed(0, "A"), false);

    pad.buttons[0] = { pressed: false, value: 0 };
    gamepad.update();
    assert.strictEqual(gamepad.isButtonDown(0, "A"), false);
    assert.strictEqual(gamepad.wasButtonJustReleased(0, "A"), true);
  });

  test("the Home button is tracked like the others", () => {
    const pad = plug();
    pad.buttons[GamepadButton.Home] = { pressed: true, value: 1 };
    gamepad.update();

    assert.strictEqual(gamepad.isButtonDown(0, "Home"), true);
    assert.strictEqual(gamepad.wasButtonJustPressed(0, "Home"), true);
  });

  test("rejects a button or a gamepad out of range", () => {
    assert.throws(() => gamepad.isButtonDown(0, 17), /Invalid gamepad info/);
    assert.throws(() => gamepad.isButtonDown(0, -1), /Invalid gamepad info/);
    assert.throws(
      () => gamepad.isButtonDown(4 as 0, "A"),
      /Invalid gamepad info/
    );
  });

  test("skips missing buttons and a short button list", () => {
    const pad = plug();
    pad.buttons = [null, { pressed: true, value: 1 }];
    gamepad.update();

    assert.strictEqual(gamepad.isButtonDown(0, 0), false);
    assert.strictEqual(gamepad.isButtonDown(0, 1), true);
    assert.strictEqual(gamepad.isButtonDown(0, 5), false);
  });

  test("tracks each gamepad on its own", () => {
    plug(0).buttons[0] = { pressed: true, value: 1 };
    plug(1).buttons[1] = { pressed: true, value: 0.8 };
    gamepad.update();

    assert.strictEqual(gamepad.isButtonDown(0, 0), true);
    assert.strictEqual(gamepad.isButtonDown(0, 1), false);
    assert.strictEqual(gamepad.isButtonDown(1, 1), true);
    assert.strictEqual(gamepad.buttonValue(1, 1), 0.8);
  });

  test("a gamepad that disappears drops its held buttons", () => {
    plug().buttons[0] = { pressed: true, value: 1 };
    gamepad.update();

    navigatorAdapter.gamepads[0] = null;
    gamepad.update();

    assert.strictEqual(gamepad.isButtonDown(0, "A"), false);
    assert.strictEqual(gamepad.wasActive, false);
  });

  test("reset() clears held buttons, values, and pending edges", () => {
    plug().buttons[0] = { pressed: true, value: 1 };
    gamepad.sample();

    gamepad.reset();
    gamepad.publish("step");

    assert.strictEqual(gamepad.isButtonDown(0, "A"), false);
    assert.strictEqual(gamepad.wasButtonJustPressed(0, "A"), false);
    assert.strictEqual(gamepad.buttonValue(0, "A"), 0);
  });
});
