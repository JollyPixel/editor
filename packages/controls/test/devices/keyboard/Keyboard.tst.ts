// Import Third-party Dependencies
import {
  expect,
  test
} from "tstyche";

// Import Internal Dependencies
import type {
  ExtendedKeyCode,
  Keyboard,
  KeyCode
} from "../../../src/index.ts";

declare const keyboard: Keyboard;
declare const text: string;

test("ExtendedKeyCode accepts codes and one-character shorthands", () => {
  expect<"KeyA">().type.toBeAssignableTo<ExtendedKeyCode>();
  expect<"A">().type.toBeAssignableTo<ExtendedKeyCode>();
  expect<"a">().type.toBeAssignableTo<ExtendedKeyCode>();
  expect<"7">().type.toBeAssignableTo<ExtendedKeyCode>();
  expect<"AB">().type.not.toBeAssignableTo<ExtendedKeyCode>();
  expect<"a">().type.not.toBeAssignableTo<KeyCode>();
});

test("state queries accept keys, shorthands and sentinels", () => {
  expect(keyboard.isDown).type.toBeCallableWith("KeyA");
  expect(keyboard.isDown).type.toBeCallableWith("a");
  expect(keyboard.wasJustPressed).type.toBeCallableWith("ANY");
  expect(keyboard.wasJustReleased).type.toBeCallableWith("NONE");
  expect(keyboard.isDown).type.not.toBeCallableWith("left");
  expect(keyboard.isDown).type.not.toBeCallableWith(text);
});

test("wasJustAutoRepeated() has no sentinel form", () => {
  expect(keyboard.wasJustAutoRepeated).type.toBeCallableWith("a");
  expect(keyboard.wasJustAutoRepeated).type.not.toBeCallableWith("ANY");
});

test("key events are named after physical codes only", () => {
  keyboard.on("KeyA", (event) => {
    expect(event).type.toBe<KeyboardEvent>();
  });
  keyboard.on("down", (event) => {
    expect(event).type.toBe<KeyboardEvent>();
  });

  expect(keyboard.on).type.not.toBeCallableWith("A", () => void 0);
  expect(keyboard.on).type.not.toBeCallableWith("a", () => void 0);
});
