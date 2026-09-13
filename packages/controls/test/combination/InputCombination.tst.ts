// Import Third-party Dependencies
import {
  expect,
  test
} from "tstyche";

// Import Internal Dependencies
import {
  InputCombination,
  type AllInputs,
  type AtLeastOneInput,
  type AtomicInput,
  type CombinedInputAction,
  type HoldInput,
  type NoneInputs,
  type SequenceInputs
} from "../../src/index.ts";

declare const text: string;

test("key() accepts bare keys, shorthands, sentinels and combined actions", () => {
  expect(InputCombination.key("KeyA")).type.toBe<AtomicInput>();
  expect(InputCombination.key).type.toBeCallableWith("KeyA", "down");
  expect(InputCombination.key).type.toBeCallableWith("A.down");
  expect(InputCombination.key).type.toBeCallableWith("a.down");
  expect(InputCombination.key).type.toBeCallableWith("7.pressed");
  expect(InputCombination.key).type.toBeCallableWith("ANY", "released");
});

test("key() rejects invalid states, sentinel combined forms and wide strings", () => {
  expect(InputCombination.key).type.not.toBeCallableWith("KeyA.down", "pressed");
  expect(InputCombination.key).type.not.toBeCallableWith("KeyA", "held");
  expect(InputCombination.key).type.not.toBeCallableWith("KeyA.held");
  expect(InputCombination.key).type.not.toBeCallableWith("ANY.down");
  expect(InputCombination.key).type.not.toBeCallableWith(text);
});

test("mouse() mirrors key() for buttons and sentinels", () => {
  expect(InputCombination.mouse("left")).type.toBe<AtomicInput>();
  expect(InputCombination.mouse).type.toBeCallableWith("scrollUp.pressed");
  expect(InputCombination.mouse).type.toBeCallableWith("ANY", "down");
  expect(InputCombination.mouse).type.toBeCallableWith("NONE");
  expect(InputCombination.mouse).type.not.toBeCallableWith("left.down", "pressed");
  expect(InputCombination.mouse).type.not.toBeCallableWith("KeyA");
  expect(InputCombination.mouse).type.not.toBeCallableWith("ANY.down");
});

test("gamepad() only accepts a known pad index", () => {
  expect(InputCombination.gamepad(0, "A")).type.toBe<AtomicInput>();
  expect(InputCombination.gamepad).type.toBeCallableWith(3, 12, "down");
  expect(InputCombination.gamepad).type.not.toBeCallableWith(4, "A");
  expect(InputCombination.gamepad).type.not.toBeCallableWith(0, "Jump");
});

test("isCombinedAction() narrows in both branches", () => {
  const action = "KeyA" as "KeyA" | "KeyA.down" | "left.pressed";

  if (InputCombination.isCombinedAction(action)) {
    expect(action).type.toBe<"KeyA.down" | "left.pressed">();
  }
  else {
    expect(action).type.toBe<"KeyA">();
  }

  const value: unknown = "KeyA.down";
  if (InputCombination.isCombinedAction(value)) {
    expect(value).type.toBe<CombinedInputAction>();
  }
});

test("composite helpers return their own condition class", () => {
  const key = InputCombination.key("KeyA");

  expect(InputCombination.all(key, "KeyB.down")).type.toBe<AllInputs>();
  expect(InputCombination.atLeastOne(key, "KeyB.down")).type.toBe<AtLeastOneInput>();
  expect(InputCombination.none(key, "KeyB.down")).type.toBe<NoneInputs>();
  expect(InputCombination.sequence(key, "KeyB.down")).type.toBe<SequenceInputs>();
  expect(InputCombination.sequenceWithTimeout(250, key)).type.toBe<SequenceInputs>();
});

test("composite helpers only take keyboard strings", () => {
  expect(InputCombination.all).type.not.toBeCallableWith("left.down");
  expect(InputCombination.all).type.not.toBeCallableWith("KeyA");
  expect(InputCombination.sequenceWithTimeout).type.not.toBeCallableWith("KeyA.down");
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
