// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { AtLeastOneInput } from "../../../src/combination/conditions/index.ts";
import { stubCondition } from "../Combination.fixture.ts";
import {
  createInputFixture,
  type InputFixture
} from "../../helpers/input.ts";

describe("Controls.AtLeastOneInput", () => {
  let input: InputFixture["input"];

  beforeEach(() => {
    ({ input } = createInputFixture());
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
});
