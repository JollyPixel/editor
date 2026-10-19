// Import Third-party Dependencies
import {
  expect,
  test
} from "tstyche";

// Import Internal Dependencies
import {
  Input,
  InputCombination,
  bindInputCondition,
  type BoundInputCondition,
  type InputDevices
} from "../../../src/index.ts";

declare const input: Input;

test("bindInputCondition() returns a BoundInputCondition", () => {
  const bound = bindInputCondition(
    InputCombination.all(
      InputCombination.key("ShiftLeft", "down"),
      InputCombination.key("ArrowRight")
    ),
    input
  );

  expect(bound).type.toBe<BoundInputCondition>();
  expect(bound()).type.toBe<boolean>();
  expect(bound.reset()).type.toBe<void>();
  expect(bound).type.not.toBeCallableWith(input);
});

test("bindInputCondition() requires the devices to read", () => {
  const condition = InputCombination.key("KeyA");

  expect(bindInputCondition).type.not.toBeCallableWith(condition);
  expect(bindInputCondition).type.not.toBeCallableWith(condition, {});
});

test("conditions read only the devices, not the whole Input", () => {
  const devices: InputDevices = {
    keyboard: input.keyboard,
    mouse: input.mouse,
    gamepad: input.gamepad
  };

  expect(InputCombination.key("KeyA").evaluate).type.toBeCallableWith(devices);
  expect(InputCombination.key("KeyA").evaluate).type.toBeCallableWith(input);
});

test("bindInputCondition() accepts a structural condition", () => {
  expect(bindInputCondition).type.toBeCallableWith(
    {
      evaluate: () => true,
      reset: () => undefined
    },
    input
  );
});
