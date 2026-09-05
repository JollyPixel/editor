// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { GamepadAxisSource } from "../../../src/index.ts";
import {
  createAxisFixture,
  type AxisFixture
} from "../Axis.fixture.ts";

describe("Controls.GamepadAxisSource", () => {
  let input: AxisFixture["input"];

  beforeEach(() => {
    ({ input } = createAxisFixture());
  });

  test("reads the device axis value", () => {
    input.gamepad.axes[0][1].value = 0.75;

    assert.strictEqual(
      new GamepadAxisSource(0, "LeftStickY").sample(input),
      0.75
    );
  });

  test("invert flips the sign", () => {
    input.gamepad.axes[0][1].value = 0.75;

    assert.strictEqual(
      new GamepadAxisSource(0, "LeftStickY", { invert: true }).sample(input),
      -0.75
    );
  });
});
