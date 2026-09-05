// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  ButtonAxisSource,
  InputCombination
} from "../../../src/index.ts";
import {
  createAxisFixture,
  type AxisFixture
} from "../Axis.fixture.ts";

describe("Controls.ButtonAxisSource", () => {
  let input: AxisFixture["input"];
  let press: AxisFixture["press"];
  let release: AxisFixture["release"];

  beforeEach(() => {
    ({
      input,
      press,
      release
    } = createAxisFixture());
  });

  test("resolves to 1, -1 and 0", () => {
    const source = new ButtonAxisSource(
      InputCombination.key("KeyW", "down"),
      InputCombination.key("KeyS", "down")
    );

    assert.strictEqual(source.sample(input), 0);

    press("KeyW");
    assert.strictEqual(source.sample(input), 1);

    release("KeyW");
    press("KeyS");
    assert.strictEqual(source.sample(input), -1);
  });

  test("cancels out when both halves are satisfied", () => {
    const source = new ButtonAxisSource(
      InputCombination.key("KeyW", "down"),
      InputCombination.key("KeyS", "down")
    );

    press("KeyW");
    press("KeyS");

    assert.strictEqual(source.sample(input), 0);
  });

  test("a null half never contributes", () => {
    const source = new ButtonAxisSource(
      InputCombination.key("Space", "down"),
      null
    );

    assert.strictEqual(source.sample(input), 0);

    press("Space");
    assert.strictEqual(source.sample(input), 1);
  });

  test("reset() resets both halves", () => {
    const conditions = [
      { evaluate: () => false, reset: () => resetCalls++ },
      { evaluate: () => false, reset: () => resetCalls++ }
    ];
    let resetCalls = 0;

    new ButtonAxisSource(conditions[0], conditions[1]).reset();

    assert.strictEqual(resetCalls, 2);
  });
});
