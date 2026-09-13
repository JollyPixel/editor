// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { Input } from "../../../src/index.ts";
import { AtLeastOneInput } from "../../../src/combination/conditions/index.ts";
import {
  createCombinationFixture,
  stubCondition
} from "../Combination.fixture.ts";

describe("Controls.AtLeastOneInput", () => {
  let input: Input;

  beforeEach(() => {
    ({ input } = createCombinationFixture());
  });

  test("is satisfied when any condition is satisfied", () => {
    assert.strictEqual(
      new AtLeastOneInput([stubCondition(false), stubCondition(true)]).evaluate(input),
      true
    );
    assert.strictEqual(
      new AtLeastOneInput([stubCondition(false), stubCondition(false)]).evaluate(input),
      false
    );
  });

  describe("bind", () => {
    test("binds to the same result as evaluate()", () => {
      assert.strictEqual(
        new AtLeastOneInput([stubCondition(false), stubCondition(true)]).bind(input)(),
        true
      );
    });

    test("reset() on the bound function resets the underlying condition", () => {
      const conditions = [stubCondition(true), stubCondition(true)];
      const bound = new AtLeastOneInput(conditions).bind(input);

      bound.reset();

      assert.deepStrictEqual(
        conditions.map((condition) => condition.resetCalls),
        [1, 1]
      );
    });
  });
});
