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
import {
  SequenceInputs,
  type InputCondition
} from "../../../src/combination/conditions/index.ts";
import {
  createCombinationFixture,
  stubCondition
} from "../Combination.fixture.ts";

describe("Controls.SequenceInputs", () => {
  let input: Input;

  beforeEach(() => {
    ({ input } = createCombinationFixture());
  });

  test("returns true once every condition has fired in order within the timeout", () => {
    let time = 0;
    const sequence = new SequenceInputs(
      [stubCondition(true), stubCondition(true)],
      100,
      () => time
    );

    assert.strictEqual(sequence.evaluate(input), false);
    time += 50;
    assert.strictEqual(sequence.evaluate(input), true);
  });

  test("restarts the sequence once the timeout between steps elapses", () => {
    let time = 0;
    let secondConditionResult = false;
    const secondCondition: InputCondition = {
      evaluate: () => secondConditionResult,
      reset: mock.fn()
    };
    const sequence = new SequenceInputs(
      [stubCondition(true), secondCondition],
      100,
      () => time
    );

    sequence.evaluate(input);
    time += 200;

    secondConditionResult = true;
    assert.strictEqual(sequence.evaluate(input), false);

    time += 1;
    assert.strictEqual(sequence.evaluate(input), true);
  });

  test("reset() restarts the sequence and resets every condition", () => {
    const conditions = [
      stubCondition(true),
      stubCondition(true)
    ];
    const sequence = new SequenceInputs(conditions, 100, () => 0);

    sequence.evaluate(input);
    sequence.reset();

    assert.deepStrictEqual(
      conditions.map((condition) => condition.resetCalls),
      [1, 1]
    );
    assert.strictEqual(sequence.evaluate(input), false);
  });

  describe("bind", () => {
    test("a bound SequenceInputs shares progress with its condition", () => {
      const sequence = new SequenceInputs(
        [stubCondition(true), stubCondition(true)],
        100,
        () => 0
      );
      const bound = sequence.bind(input);

      assert.strictEqual(bound(), false);
      assert.strictEqual(sequence.evaluate(input), true);

      bound();
      bound.reset();
      assert.strictEqual(bound(), false);
      assert.strictEqual(bound(), true);
    });
  });
});
