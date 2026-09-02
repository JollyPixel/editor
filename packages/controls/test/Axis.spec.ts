// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  Input,
  Axis,
  ButtonAxisSource,
  GamepadAxisSource,
  InputCombination,
  type KeyCode,
  type AxisSource
} from "../src/index.ts";
import * as mocks from "./mocks/index.ts";

function stubSource(
  value: number
): AxisSource & { resetCalls: number; } {
  return {
    resetCalls: 0,
    sample: () => value,
    reset() {
      this.resetCalls++;
    }
  };
}

describe("Controls.Axis", () => {
  let input: Input;

  function press(
    code: KeyCode
  ) {
    input.keyboard.buttonsDown.add(code);
  }

  function release(
    code: KeyCode
  ) {
    input.keyboard.buttonsDown.delete(code);
  }

  beforeEach(() => {
    input = new Input(new mocks.CanvasAdapter(), {
      documentAdapter: new mocks.DocumentAdapter()
    });
  });

  describe("ButtonAxisSource", () => {
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

  describe("GamepadAxisSource", () => {
    test("reads the device axis value", () => {
      input.gamepad.axes[0][1].value = 0.75;

      assert.strictEqual(
        new GamepadAxisSource(0, "LeftStickY").sample(input),
        0.75
      );
    });

    test("invert flips the sign", () => {
      input.gamepad.axes[0][1].value = 0.75;

      assert.strictEqual(
        new GamepadAxisSource(0, "LeftStickY", { invert: true }).sample(input),
        -0.75
      );
    });
  });

  describe("Axis", () => {
    test("buttons() reads a string half as a keyboard action", () => {
      const axis = Axis.buttons("KeyW.down", "KeyS.down");

      press("KeyW");
      assert.strictEqual(axis.sample(input), 1);
    });

    test("buttons() reads a bare keyboard action as down", () => {
      const axis = Axis.buttons("KeyW", "KeyS");

      press("KeyS");
      assert.strictEqual(axis.sample(input), -1);
    });

    test("buttons() accepts an InputCondition for alternatives", () => {
      const axis = Axis.buttons(
        InputCombination.atLeastOne("KeyW.down", "ArrowUp.down"),
        null
      );

      press("ArrowUp");
      assert.strictEqual(axis.sample(input), 1);
    });

    test("invert and scale apply to the resolved value", () => {
      const axis = Axis.buttons("KeyW.down", null, {
        invert: true,
        scale: 3
      });

      press("KeyW");
      assert.strictEqual(axis.sample(input), -3);
    });

    test("the source with the largest magnitude wins", () => {
      const axis = new Axis([
        stubSource(0.2),
        stubSource(-0.9),
        stubSource(0.5)
      ]);

      assert.strictEqual(axis.sample(input), -0.9);
    });

    test("or() keeps the existing sources and options", () => {
      const axis = Axis.buttons("KeyW.down", null, { scale: 2 })
        .or(stubSource(0.4));

      press("KeyW");
      assert.strictEqual(axis.sample(input), 2);

      release("KeyW");
      assert.strictEqual(axis.sample(input), 0.8);
    });

    test("or() returns a new axis and leaves the original alone", () => {
      const axis = Axis.buttons(null, null);
      const combined = axis.or(stubSource(1));

      assert.notStrictEqual(axis, combined);
      assert.strictEqual(axis.sample(input), 0);
      assert.strictEqual(combined.sample(input), 1);
    });

    test("gamepadStick() binds one stick axis", () => {
      const axis = Axis.gamepadStick(0, "LeftStickX");
      input.gamepad.axes[0][0].value = -0.5;

      assert.strictEqual(axis.sample(input), -0.5);
    });

    test("gamepadStick() applies invert exactly once", () => {
      const axis = Axis.gamepadStick(
        0,
        "LeftStickY",
        { invert: true }
      );
      input.gamepad.axes[0][1].value = 0.75;

      assert.strictEqual(axis.sample(input), -0.75);
    });

    test("opposing sources with equal magnitude cancel out", () => {
      const axis = new Axis([
        stubSource(1),
        stubSource(-1)
      ]);

      assert.strictEqual(axis.sample(input), 0);
    });

    test("clamps source values before resolving and scaling", () => {
      const axis = new Axis(
        [stubSource(2)],
        { scale: 3 }
      );

      assert.strictEqual(axis.sample(input), 3);
    });

    test("one source resolves exactly like the same value among many", () => {
      for (const value of [0, 0.5, -0.5, 1, -1, 2, -2]) {
        const alone = new Axis(
          [stubSource(value)],
          {
            invert: true,
            scale: 3
          }
        );
        const amongOthers = new Axis(
          [stubSource(value), stubSource(0)],
          {
            invert: true,
            scale: 3
          }
        );

        assert.strictEqual(
          alone.sample(input),
          amongOthers.sample(input),
          `diverged on ${value}`
        );
      }
    });

    test("clamps a single negative source below -1", () => {
      const axis = new Axis(
        [stubSource(-2)],
        { scale: 3 }
      );

      assert.strictEqual(axis.sample(input), -3);
    });

    test("resetSources() resets every source", () => {
      const sources = [stubSource(0), stubSource(0)];
      new Axis(sources).resetSources();

      assert.deepStrictEqual(
        sources.map((source) => source.resetCalls),
        [1, 1]
      );
    });
  });
});
