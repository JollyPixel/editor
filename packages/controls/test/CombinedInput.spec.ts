// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach,
  mock
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Input } from "../src/index.ts";
import {
  AllInputs,
  AtLeastOneInput,
  NoneInputs,
  SequenceInputs,
  InputCombination
} from "../src/CombinedInput.ts";
import type { InputCondition } from "../src/AtomicInput.ts";
import * as mocks from "./mocks/index.ts";

function stubCondition(
  result: boolean
): InputCondition & { resetCalls: number; } {
  return {
    resetCalls: 0,
    evaluate: () => result,
    reset() {
      this.resetCalls++;
    }
  };
}

describe("Controls.CombinedInput", () => {
  let canvas: mocks.CanvasAdapter;
  let input: Input;

  beforeEach(() => {
    canvas = new mocks.CanvasAdapter();
    input = new Input(canvas, {
      documentAdapter: new mocks.DocumentAdapter()
    });
    // Mouse state now lives in private bitmasks, so it is driven through the
    // DOM handlers rather than written directly.
    input.mouse.connect();
  });

  describe("AllInputs", () => {
    test("is satisfied only when every condition is satisfied", () => {
      assert.strictEqual(new AllInputs([stubCondition(true), stubCondition(true)]).evaluate(input), true);
      assert.strictEqual(new AllInputs([stubCondition(true), stubCondition(false)]).evaluate(input), false);
    });

    test("reset() resets every condition", () => {
      const conditions = [stubCondition(true), stubCondition(true)];
      new AllInputs(conditions).reset();

      assert.deepStrictEqual(conditions.map((condition) => condition.resetCalls), [1, 1]);
    });
  });

  describe("AtLeastOneInput", () => {
    test("is satisfied when any condition is satisfied", () => {
      assert.strictEqual(new AtLeastOneInput([stubCondition(false), stubCondition(true)]).evaluate(input), true);
      assert.strictEqual(new AtLeastOneInput([stubCondition(false), stubCondition(false)]).evaluate(input), false);
    });
  });

  describe("NoneInputs", () => {
    test("is satisfied only when no condition is satisfied", () => {
      assert.strictEqual(new NoneInputs([stubCondition(false), stubCondition(false)]).evaluate(input), true);
      assert.strictEqual(new NoneInputs([stubCondition(false), stubCondition(true)]).evaluate(input), false);
    });
  });

  describe("SequenceInputs", () => {
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
      const conditions = [stubCondition(true), stubCondition(true)];
      const sequence = new SequenceInputs(conditions, 100, () => 0);

      sequence.evaluate(input);
      sequence.reset();

      assert.deepStrictEqual(conditions.map((condition) => condition.resetCalls), [1, 1]);
      assert.strictEqual(sequence.evaluate(input), false);
    });
  });

  describe("InputCombination", () => {
    test("isCombinedAction() distinguishes a dot-path action from a plain key", () => {
      assert.strictEqual(InputCombination.isCombinedAction("KeyA.pressed"), true);
      assert.strictEqual(InputCombination.isCombinedAction("KeyA"), false);
      assert.strictEqual(InputCombination.isCombinedAction(42), false);
    });

    test("key() accepts a bare key with a default/explicit state, or a dot-path action", () => {
      input.keyboard.buttonsDown.add("KeyA");

      assert.strictEqual(InputCombination.key("KeyA").evaluate(input), false);
      assert.strictEqual(InputCombination.key("KeyA", "down").evaluate(input), true);
      assert.strictEqual(InputCombination.key("KeyA.down").evaluate(input), true);
    });

    test("mouse() accepts a bare button with a default/explicit state, or a dot-path action", () => {
      canvas.dispatch("mousedown", { button: 0, preventDefault: () => void 0 });
      // Two ticks: the second clears `wasJustPressed`, leaving the button held
      // but no longer freshly pressed, which is what the default state needs.
      input.mouse.update();
      input.mouse.update();

      assert.strictEqual(InputCombination.mouse("left").evaluate(input), false);
      assert.strictEqual(InputCombination.mouse("left", "down").evaluate(input), true);
      assert.strictEqual(InputCombination.mouse("left.down").evaluate(input), true);
    });

    test("gamepad() builds an atomic gamepad condition", () => {
      input.gamepad.buttons[0][0].isDown = true;

      assert.strictEqual(InputCombination.gamepad(0, "A", "down").evaluate(input), true);
    });

    test("all() / atLeastOne() / none() accept a mix of conditions and dot-path actions", () => {
      input.keyboard.buttonsDown.add("KeyA");

      assert.strictEqual(
        InputCombination.all("KeyA.down", stubCondition(true)).evaluate(input),
        true
      );
      assert.strictEqual(
        InputCombination.atLeastOne("KeyB.down", "KeyA.down").evaluate(input),
        true
      );
      assert.strictEqual(
        InputCombination.none("KeyB.down").evaluate(input),
        true
      );
    });

    test("sequence() / sequenceWithTimeout() build a SequenceInputs from dot-path actions", () => {
      input.keyboard.buttonsDown.add("KeyA");
      input.keyboard.buttonsDown.add("KeyB");

      const sequence = InputCombination.sequenceWithTimeout(50, "KeyA.down", "KeyB.down");

      assert.ok(sequence instanceof SequenceInputs);
      assert.strictEqual(sequence.evaluate(input), false);
      assert.strictEqual(sequence.evaluate(input), true);
    });
  });
});
