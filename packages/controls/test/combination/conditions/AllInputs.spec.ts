// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { AllInputs } from "../../../src/combination/conditions/index.ts";
import { stubCondition } from "../Combination.fixture.ts";
import {
  createInputFixture,
  type InputFixture
} from "../../helpers/input.ts";

describe("Controls.AllInputs", () => {
  let input: InputFixture["input"];

  beforeEach(() => {
    ({ input } = createInputFixture());
  });

  test("is satisfied only when every condition is satisfied", () => {
    assert.strictEqual(
      new AllInputs([stubCondition(true), stubCondition(true)]).evaluate(input),
      true
    );
    assert.strictEqual(
      new AllInputs([stubCondition(true), stubCondition(false)]).evaluate(input),
      false
    );
  });

  test("reset() resets every condition", () => {
    const conditions = [stubCondition(true), stubCondition(true)];
    new AllInputs(conditions).reset();

    assert.deepStrictEqual(conditions.map((condition) => condition.resetCalls), [1, 1]);
  });
});
