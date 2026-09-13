// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach,
  mock
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { Input } from "../../../src/index.ts";
import { AllInputs } from "../../../src/combination/conditions/index.ts";
import {
  createCombinationFixture,
  stubCondition
} from "../Combination.fixture.ts";

describe("Controls.AllInputs", () => {
  let input: Input;

  beforeEach(() => {
    ({ input } = createCombinationFixture());
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

  describe("bind", () => {
    test("binds to the same result as evaluate()", () => {
      assert.strictEqual(
        new AllInputs([stubCondition(true), stubCondition(false)]).bind(input)(),
        false
      );
    });

    test("passes the bound Input to every evaluation", () => {
      const evaluate = mock.fn((_input: Input) => true);
      const bound = new AllInputs([
        {
          evaluate,
          reset: () => void 0
        }
      ]).bind(input);

      bound();
      bound();

      assert.deepStrictEqual(
        evaluate.mock.calls.map((call) => call.arguments[0]),
        [input, input]
      );
    });
  });
});
