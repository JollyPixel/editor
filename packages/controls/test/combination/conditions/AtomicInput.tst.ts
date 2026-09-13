// Import Third-party Dependencies
import {
  expect,
  test
} from "tstyche";

// Import Internal Dependencies
import {
  AtomicInput,
  type CombinedInputType
} from "../../../src/index.ts";

declare const type: CombinedInputType;

test("each input type accepts its own action", () => {
  expect(AtomicInput).type.toBeConstructableWith("key", "KeyA");
  expect(AtomicInput).type.toBeConstructableWith("key", "ANY", "down");
  expect(AtomicInput).type.toBeConstructableWith("mouse", "left", "released");
  expect(AtomicInput).type.toBeConstructableWith("mouse", "NONE");
  expect(AtomicInput).type.toBeConstructableWith("gamepad", [0, "A"]);
  expect(AtomicInput).type.toBeConstructableWith("gamepad", [3, 12], "down");
});

test("an action cannot be paired with another input type", () => {
  expect(AtomicInput).type.not.toBeConstructableWith("key", "left");
  expect(AtomicInput).type.not.toBeConstructableWith("mouse", "KeyA");
  expect(AtomicInput).type.not.toBeConstructableWith("gamepad", "KeyA");
  expect(AtomicInput).type.not.toBeConstructableWith("key", [0, "A"]);
});

test("a widened input type is rejected", () => {
  expect(AtomicInput).type.not.toBeConstructableWith(type, "KeyA");
});

test("state must be a combined input state", () => {
  expect(AtomicInput).type.not.toBeConstructableWith("key", "KeyA", "held");
});
