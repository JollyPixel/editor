// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { Input } from "../../../src/index.ts";
import { NoneInputs } from "../../../src/combination/conditions/index.ts";
import {
  createCombinationFixture,
  stubCondition
} from "../Combination.fixture.ts";

describe("Controls.NoneInputs", () => {
  let input: Input;

  beforeEach(() => {
    ({ input } = createCombinationFixture());
  });

  test("is satisfied only when no condition is satisfied", () => {
    assert.strictEqual(
      new NoneInputs([stubCondition(false), stubCondition(false)]).evaluate(input),
      true
    );
    assert.strictEqual(
      new NoneInputs([stubCondition(false), stubCondition(true)]).evaluate(input),
      false
    );
  });

  describe("bind", () => {
    test("binds to the same result as evaluate()", () => {
      assert.strictEqual(
        new NoneInputs([stubCondition(false)]).bind(input)(),
        true
      );
    });
  });
});
