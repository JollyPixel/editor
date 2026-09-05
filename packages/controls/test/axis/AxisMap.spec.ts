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
  AxisMap,
  UnknownAxisError,
  InputCombination,
  type KeyCode
} from "../../src/index.ts";
import * as mocks from "../mocks/index.ts";

describe("Controls.AxisMap", () => {
  let input: Input;
  let axes: AxisMap<"moveRight" | "moveUp" | "moveForward">;

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

    axes = new AxisMap({
      moveRight: Axis.buttons("KeyD.down", "KeyA.down"),
      moveUp: Axis.buttons(
        "Space.down",
        InputCombination.atLeastOne("ShiftLeft.down", "ShiftRight.down")
      ),
      moveForward: Axis.buttons("KeyW.down", "KeyS.down")
    });
  });

  test("every axis starts at 0", () => {
    assert.strictEqual(axes.value("moveRight"), 0);
    assert.strictEqual(axes.value("moveUp"), 0);
    assert.strictEqual(axes.value("moveForward"), 0);
  });

  test("names exposes every bound axis", () => {
    assert.deepStrictEqual(
      [...axes.names],
      ["moveRight", "moveUp", "moveForward"]
    );
  });

  test("update() samples every axis", () => {
    press("KeyW");
    press("KeyA");
    axes.update(input);

    assert.strictEqual(axes.value("moveForward"), 1);
    assert.strictEqual(axes.value("moveRight"), -1);
    assert.strictEqual(axes.value("moveUp"), 0);
  });

  test("values are cached between two update() calls", () => {
    press("KeyW");
    axes.update(input);
    release("KeyW");

    assert.strictEqual(axes.value("moveForward"), 1);

    axes.update(input);
    assert.strictEqual(axes.value("moveForward"), 0);
  });

  test("update() holds every axis at 0 while disabled", () => {
    press("KeyW");
    axes.enabled = false;
    axes.update(input);

    assert.strictEqual(axes.value("moveForward"), 0);

    axes.enabled = true;
    axes.update(input);
    assert.strictEqual(axes.value("moveForward"), 1);
  });

  test("disabling clears values sampled while enabled", () => {
    press("KeyW");
    axes.update(input);

    assert.strictEqual(axes.value("moveForward"), 1);

    axes.enabled = false;
    axes.update(input);

    assert.strictEqual(axes.value("moveForward"), 0);
  });

  test("repeated disabled updates keep every axis at 0", () => {
    press("KeyW");
    axes.update(input);
    axes.enabled = false;

    for (let count = 0; count < 3; count++) {
      axes.update(input);
      assert.strictEqual(axes.value("moveForward"), 0);
    }

    axes.enabled = true;
    axes.update(input);

    assert.strictEqual(axes.value("moveForward"), 1);
  });

  test("reset() while disabled leaves the map sampling again once enabled", () => {
    press("KeyW");
    axes.enabled = false;
    axes.update(input);
    axes.reset();
    axes.enabled = true;
    axes.update(input);

    assert.strictEqual(axes.value("moveForward"), 1);
  });

  test("value() throws on an unknown axis", () => {
    assert.throws(
      () => axes.value("moveBackward" as "moveUp"),
      UnknownAxisError
    );
  });

  test("vector3() writes into the target and returns it", () => {
    press("KeyD");
    press("ShiftLeft");
    press("KeyS");
    axes.update(input);

    const target = { x: 0, y: 0, z: 0 };
    const result = axes.vector3(
      "moveRight",
      "moveUp",
      "moveForward",
      target
    );

    assert.strictEqual(result, target);
    assert.deepStrictEqual(target, { x: 1, y: -1, z: -1 });
  });

  test("vector2() writes into the target and returns it", () => {
    press("KeyD");
    axes.update(input);

    const target = { x: 0, y: 0 };

    assert.deepStrictEqual(
      axes.vector2("moveRight", "moveUp", target),
      { x: 1, y: 0 }
    );
  });

  test("reset() clears every cached value", () => {
    press("KeyW");
    axes.update(input);
    axes.reset();

    assert.strictEqual(axes.value("moveForward"), 0);
  });
});
