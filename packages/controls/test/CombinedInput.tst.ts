// Import Third-party Dependencies
import {
  expect,
  test
} from "tstyche";

// Import Internal Dependencies
import {
  Input,
  InputCombination,
  type HoldInput,
  type SequenceInputs,
  bindInputCondition,
  type BoundInputCondition
} from "../src/index.ts";

declare const input: Input;

test("bind() returns a BoundInputCondition", () => {
  const bound = InputCombination.all(
    InputCombination.key("ShiftLeft", "down"),
    InputCombination.key("ArrowRight")
  ).bind(input);

  expect(bound).type.toBe<BoundInputCondition>();
  expect(bound()).type.toBe<boolean>();
  expect(bound.reset()).type.toBe<void>();
});

test("every condition exposes bind()", () => {
  expect(InputCombination.key("KeyA").bind(input)).type.toBe<BoundInputCondition>();
  expect(InputCombination.mouse("left").bind(input)).type.toBe<BoundInputCondition>();
  expect(InputCombination.atLeastOne("KeyA.down").bind(input)).type.toBe<BoundInputCondition>();
  expect(InputCombination.none("KeyA.down").bind(input)).type.toBe<BoundInputCondition>();
  expect(InputCombination.sequence("KeyA.pressed").bind(input)).type.toBe<BoundInputCondition>();
});

test("bind() requires an Input", () => {
  const condition = InputCombination.key("KeyA");

  expect(condition.bind).type.not.toBeCallableWith();
  expect(condition.bind).type.not.toBeCallableWith({});
});

test("the bound function takes no argument", () => {
  const bound = InputCombination.key("KeyA").bind(input);

  expect(bound).type.not.toBeCallableWith(input);
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

test("hold() accepts a key or an entry/sustain pair", () => {
  expect(InputCombination.hold("ControlLeft")).type.toBe<HoldInput>();
  expect(InputCombination.hold).type.toBeCallableWith(
    InputCombination.mouse("left", "pressed"),
    InputCombination.mouse("left", "down")
  );
  expect(InputCombination.sequence(
    InputCombination.hold("ControlLeft"),
    "KeyX.pressed"
  )).type.toBe<SequenceInputs>();
});

test("hold() rejects mouse actions and a lone condition", () => {
  expect(InputCombination.hold).type.not.toBeCallableWith("left");
  expect(InputCombination.hold).type.not.toBeCallableWith("ControlLeft.pressed");
  expect(InputCombination.hold).type.not.toBeCallableWith(
    InputCombination.key("KeyA")
  );
});
