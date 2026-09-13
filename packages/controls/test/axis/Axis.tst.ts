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

test("Axis accepts bare keys and sentinels as halves", () => {
  expect(Axis.buttons).type.toBeCallableWith("d", "a");
  expect(Axis.buttons).type.toBeCallableWith("ANY");
  expect(Axis.buttons).type.not.toBeCallableWith("KeyW.held");
});

test("gamepadStick() takes a pad index and a stick axis", () => {
  expect(Axis.gamepadStick(3, 1)).type.toBe<Axis>();
  expect(Axis.gamepadStick).type.not.toBeCallableWith(4, "LeftStickX");
  expect(Axis.gamepadStick).type.not.toBeCallableWith(0, "A");
});

test("resolved axes cannot nest as raw sources", () => {
  const buttons = Axis.buttons("KeyW", "KeyS");
  const stick = Axis.gamepadStick(0, "LeftStickY");

  expect(buttons.or).type.not.toBeCallableWith(stick);
});
