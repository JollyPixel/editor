// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { bindInputCondition } from "../../../src/combination/conditions/index.ts";
import { stubCondition } from "../Combination.fixture.ts";
import {
  createInputFixture,
  type InputFixture
} from "../../helpers/input.ts";

describe("Controls.bindInputCondition", () => {
  let input: InputFixture["input"];

  beforeEach(() => {
    ({ input } = createInputFixture());
  });

  test("binds a plain InputCondition object", () => {
    const bound = bindInputCondition(stubCondition(true), input);

    assert.strictEqual(bound(), true);
  });

  test("reset() on the bound function resets the condition", () => {
    const condition = stubCondition(true);
    const bound = bindInputCondition(condition, input);

    bound.reset();

    assert.strictEqual(condition.resetCalls, 1);
  });
});
