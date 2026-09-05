// Import Third-party Dependencies
import {
  expect,
  test
} from "tstyche";

// Import Internal Dependencies
import {
  Axis,
  InputCombination
} from "../../src/index.ts";

test("Axis accepts keyboard and explicit mouse conditions", () => {
  expect(Axis.buttons).type.toBeCallableWith(
    "KeyW.down",
    "KeyS.down"
  );
  expect(Axis.buttons).type.toBeCallableWith(
    InputCombination.mouse("left.down"),
    null
  );
});

test("mouse strings cannot reach keyboard conditions", () => {
  expect(Axis.buttons).type.not.toBeCallableWith("left.down", null);
  expect(InputCombination.key).type.not.toBeCallableWith("left.down");
  expect(InputCombination.atLeastOne).type.not.toBeCallableWith("left.down");
});

test("resolved axes cannot nest as raw sources", () => {
  const buttons = Axis.buttons("KeyW", "KeyS");
  const stick = Axis.gamepadStick(0, "LeftStickY");

  expect(buttons.or).type.not.toBeCallableWith(stick);
});
