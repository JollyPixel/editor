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
  let tilt: AxisFixture["tilt"];

  beforeEach(() => {
    ({ input, tilt } = createAxisFixture());
  });

  test("reads the device axis value", () => {
    tilt([0, 0.75, 0, 0]);

    assert.strictEqual(
      new GamepadAxisSource(0, "LeftStickY").sample(input),
      0.75
    );
  });

  test("invert flips the sign", () => {
    tilt([0, 0.75, 0, 0]);

    assert.strictEqual(
      new GamepadAxisSource(0, "LeftStickY", { invert: true }).sample(input),
      -0.75
    );
  });
});
