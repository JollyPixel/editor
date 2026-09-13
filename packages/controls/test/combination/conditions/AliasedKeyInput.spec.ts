// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { Input, KeyCode } from "../../../src/index.ts";
import { AliasedKeyInput } from "../../../src/combination/conditions/index.ts";
import { createCombinationFixture } from "../Combination.fixture.ts";

describe("Controls.AliasedKeyInput", () => {
  let input: Input;

  function press(
    code: KeyCode
  ) {
    if (!input.keyboard.buttons.has(code)) {
      input.keyboard.buttons.set(code, {
        code,
        isDown: false,
        wasJustPressed: false,
        wasJustAutoRepeated: false,
        wasJustReleased: false
      });
    }
    input.keyboard.buttonsDown.add(code);
  }

  function release(
    code: KeyCode
  ) {
    input.keyboard.buttonsDown.delete(code);
  }

  function tick() {
    input.keyboard.update();
  }

  function snapshot(
    condition: AliasedKeyInput
  ) {
    return {
      down: condition.down.evaluate(input),
      pressed: condition.pressed.evaluate(input),
      released: condition.released.evaluate(input)
    };
  }

  beforeEach(() => {
    ({ input } = createCombinationFixture());
  });

  test("defaults to the down state", () => {
    const condition = new AliasedKeyInput(["ShiftLeft", "ShiftRight"]);

    assert.strictEqual(condition.state, "down");
    assert.strictEqual(condition.down, condition);
  });

  test("is down while any alias is held", () => {
    const condition = new AliasedKeyInput(["ShiftLeft", "ShiftRight"]);

    assert.strictEqual(condition.evaluate(input), false);

    press("ShiftRight");
    tick();
    assert.strictEqual(condition.evaluate(input), true);
  });

  test("down matches the keyboard isDown query like an atomic key", () => {
    const condition = new AliasedKeyInput(["ShiftLeft", "ShiftRight"]);

    press("ShiftLeft");
    assert.strictEqual(condition.evaluate(input), input.keyboard.isDown("ShiftLeft"));
    assert.strictEqual(condition.pressed.evaluate(input), false);

    tick();
    assert.strictEqual(condition.pressed.evaluate(input), true);
  });

  test("pressed fires once when the first alias goes down", () => {
    const condition = new AliasedKeyInput(["ControlLeft", "ControlRight"]);

    press("ControlLeft");
    tick();
    assert.deepStrictEqual(snapshot(condition), {
      down: true,
      pressed: true,
      released: false
    });

    tick();
    assert.strictEqual(condition.pressed.evaluate(input), false);

    press("ControlRight");
    tick();
    assert.strictEqual(condition.pressed.evaluate(input), false);
  });

  test("released fires only once the last alias goes up", () => {
    const condition = new AliasedKeyInput(["ControlLeft", "ControlRight"]);

    press("ControlLeft");
    press("ControlRight");
    tick();

    release("ControlLeft");
    tick();
    assert.deepStrictEqual(snapshot(condition), {
      down: true,
      pressed: false,
      released: false
    });

    release("ControlRight");
    tick();
    assert.deepStrictEqual(snapshot(condition), {
      down: false,
      pressed: false,
      released: true
    });

    tick();
    assert.strictEqual(condition.released.evaluate(input), false);
  });

  test("pressing both aliases in the same frame fires pressed once", () => {
    const condition = new AliasedKeyInput(["AltLeft", "AltRight"]);

    press("AltLeft");
    press("AltRight");
    tick();

    assert.strictEqual(condition.pressed.evaluate(input), true);
  });

  test("swapping aliases in the same frame produces no edge", () => {
    const condition = new AliasedKeyInput(["AltLeft", "AltRight"]);

    press("AltLeft");
    tick();

    release("AltLeft");
    press("AltRight");
    tick();

    assert.deepStrictEqual(snapshot(condition), {
      down: true,
      pressed: false,
      released: false
    });
  });

  test("state getters return shared instances across the family", () => {
    const condition = new AliasedKeyInput(["KeyW", "ArrowUp"]);

    assert.strictEqual(condition.pressed, condition.pressed);
    assert.strictEqual(condition.pressed.released.down, condition);
    assert.strictEqual(condition.released.state, "released");
  });

  test("resolves extended key shorthands and drops duplicates", () => {
    const condition = new AliasedKeyInput(["w", "KeyW", "ArrowUp"]);

    assert.deepStrictEqual(condition.keys, ["KeyW", "ArrowUp"]);

    press("KeyW");
    tick();
    assert.strictEqual(condition.evaluate(input), true);
  });

  test("copies the given keys and the returned keys", () => {
    const keys: KeyCode[] = ["KeyA"];
    const condition = new AliasedKeyInput(keys);
    keys.push("KeyB");

    condition.keys.push("KeyC");
    assert.deepStrictEqual(condition.keys, ["KeyA"]);
  });

  test("resolves a key resolver once, on first use, for the whole family", () => {
    let calls = 0;
    const condition = new AliasedKeyInput(() => {
      calls++;

      return ["MetaLeft", "MetaRight"];
    });

    assert.strictEqual(calls, 0);

    press("MetaRight");
    tick();
    assert.strictEqual(condition.evaluate(input), true);
    assert.strictEqual(condition.pressed.evaluate(input), true);
    assert.strictEqual(calls, 1);
  });

  test("bind() evaluates against the bound input", () => {
    const condition = new AliasedKeyInput(["Enter", "NumpadEnter"]);
    const isEntering = condition.pressed.bind(input);

    press("NumpadEnter");
    tick();

    assert.strictEqual(isEntering(), true);
    assert.doesNotThrow(() => isEntering.reset());
  });
});
