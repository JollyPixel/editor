// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { NoneInputs } from "../../../src/combination/conditions/index.ts";
import { stubCondition } from "../Combination.fixture.ts";
import {
  createInputFixture,
  type InputFixture
} from "../../helpers/input.ts";

describe("Controls.NoneInputs", () => {
  let input: InputFixture["input"];

  beforeEach(() => {
    ({ input } = createInputFixture());
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
});
