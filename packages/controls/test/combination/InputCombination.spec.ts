// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  bindInputCondition,
  HoldInput,
  SequenceInputs,
  InputCombination
} from "../../src/combination/index.ts";
import { stubCondition } from "./Combination.fixture.ts";
import {
  createInputFixture,
  type InputFixture
} from "../helpers/input.ts";
import { isApplePlatform } from "../../src/platform.ts";

describe("Controls.InputCombination", () => {
  let canvas: InputFixture["canvas"];
  let input: InputFixture["input"];
  let press: InputFixture["press"];
  let plug: InputFixture["plug"];

  beforeEach(() => {
    ({
      canvas,
      input,
      press,
      plug
    } = createInputFixture());
  });

  test("isCombinedAction() distinguishes a dot-path action from a plain key", () => {
    assert.strictEqual(InputCombination.isCombinedAction("KeyA.pressed"), true);
    assert.strictEqual(InputCombination.isCombinedAction("KeyA"), false);
    assert.strictEqual(InputCombination.isCombinedAction(42), false);
  });

  test("isCombinedAction() rejects an unknown or missing state segment", () => {
    assert.strictEqual(InputCombination.isCombinedAction("KeyA.held"), false);
    assert.strictEqual(InputCombination.isCombinedAction("KeyA."), false);
    assert.strictEqual(InputCombination.isCombinedAction(".down"), false);
    assert.strictEqual(InputCombination.isCombinedAction("KeyA.down.up"), false);
  });

  test("mouse() accepts the ANY and NONE sentinels", () => {
    assert.strictEqual(InputCombination.mouse("NONE", "down").evaluate(input), true);
    assert.strictEqual(InputCombination.mouse("ANY", "down").evaluate(input), false);
  });

  test("key() resolves an uppercase letter shorthand", () => {
    press("KeyA");

    assert.strictEqual(InputCombination.key("A.down").evaluate(input), true);
  });

  test("key() accepts a bare key with a default/explicit state, or a dot-path action", () => {
    press("KeyA");

    assert.strictEqual(InputCombination.key("KeyA").evaluate(input), false);
    assert.strictEqual(InputCombination.key("KeyA", "down").evaluate(input), true);
    assert.strictEqual(InputCombination.key("KeyA.down").evaluate(input), true);
  });

  test("mouse() accepts a bare button with a default/explicit state, or a dot-path action", () => {
    canvas.dispatchMouseEvent("mousedown", { button: 0 });
    input.update();
    input.update();

    assert.strictEqual(InputCombination.mouse("left").evaluate(input), false);
    assert.strictEqual(InputCombination.mouse("left", "down").evaluate(input), true);
    assert.strictEqual(InputCombination.mouse("left.down").evaluate(input), true);
  });

  test("gamepad() builds an atomic gamepad condition", () => {
    plug().buttons[0] = {
      pressed: true,
      value: 1
    };
    input.update();

    assert.strictEqual(InputCombination.gamepad(0, "A", "down").evaluate(input), true);
  });

  test("all() / atLeastOne() / none() accept a mix of conditions and dot-path actions", () => {
    press("KeyA");

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
    press("KeyA");
    press("KeyB");

    const sequence = InputCombination.sequenceWithTimeout(
      50,
      "KeyA.down",
      "KeyB.down"
    );

    assert.ok(sequence instanceof SequenceInputs);
    assert.strictEqual(sequence.evaluate(input), false);
    assert.strictEqual(sequence.evaluate(input), true);
  });

  test("hold() builds a pressed/down HoldInput from a key", () => {
    press("ControlLeft");

    const hold = InputCombination.hold("ControlLeft");

    assert.ok(hold instanceof HoldInput);
    assert.strictEqual(hold.entry.evaluate(input), false);
    assert.strictEqual(hold.sustain.evaluate(input), true);
    assert.strictEqual(hold.evaluate(input), true);
  });

  test("hold() accepts explicit entry and sustain conditions", () => {
    const entry = stubCondition(true);
    const sustain = stubCondition(false);
    const hold = InputCombination.hold(entry, sustain);

    assert.strictEqual(hold.entry, entry);
    assert.strictEqual(hold.sustain, sustain);
    assert.strictEqual(hold.evaluate(input), false);

    hold.reset();
    assert.deepStrictEqual([entry.resetCalls, sustain.resetCalls], [1, 1]);
  });

  test("hold() throws when a condition has no sustain condition", () => {
    assert.throws(
      () => Reflect.apply(InputCombination.hold, InputCombination, [stubCondition(true)]),
      TypeError
    );
  });

  test("modifier, enter and movement presets alias both physical keys", () => {
    assert.deepStrictEqual(
      {
        Control: InputCombination.Control.keys,
        Shift: InputCombination.Shift.keys,
        Alt: InputCombination.Alt.keys,
        Meta: InputCombination.Meta.keys,
        Enter: InputCombination.Enter.keys,
        MoveUp: InputCombination.MoveUp.keys,
        MoveDown: InputCombination.MoveDown.keys,
        MoveLeft: InputCombination.MoveLeft.keys,
        MoveRight: InputCombination.MoveRight.keys
      },
      {
        Control: ["ControlLeft", "ControlRight"],
        Shift: ["ShiftLeft", "ShiftRight"],
        Alt: ["AltLeft", "AltRight"],
        Meta: ["MetaLeft", "MetaRight"],
        Enter: ["Enter", "NumpadEnter"],
        MoveUp: ["KeyW", "ArrowUp"],
        MoveDown: ["KeyS", "ArrowDown"],
        MoveLeft: ["KeyA", "ArrowLeft"],
        MoveRight: ["KeyD", "ArrowRight"]
      }
    );
  });

  test("Mod aliases Meta on Apple platforms and Control elsewhere", () => {
    const expected = isApplePlatform() ?
      InputCombination.Meta.keys :
      InputCombination.Control.keys;

    assert.deepStrictEqual(InputCombination.Mod.keys, expected);
  });

  test("presets are shared instances in the down state", () => {
    assert.strictEqual(InputCombination.Shift, InputCombination.Shift);
    assert.strictEqual(InputCombination.Shift.state, "down");
    assert.strictEqual(
      InputCombination.Shift.pressed,
      InputCombination.Shift.pressed
    );
  });

  test("a preset composes into a chord", () => {
    press("ControlRight");
    press("KeyS");
    input.update();

    const save = bindInputCondition(
      InputCombination.all(InputCombination.Control, "KeyS.pressed"),
      input
    );

    assert.strictEqual(save(), true);
  });

  test("chains off an InputCombination factory", () => {
    press("ShiftLeft");
    press("ArrowRight");

    const dash = bindInputCondition(
      InputCombination.all(
        InputCombination.key("ShiftLeft", "down"),
        InputCombination.key("ArrowRight", "down")
      ),
      input
    );

    assert.strictEqual(dash(), true);
  });
});
