// Import Third-party Dependencies
import {
  expect,
  test
} from "tstyche";

// Import Internal Dependencies
import type { Gamepad } from "../../../src/index.ts";

declare const gamepad: Gamepad;

test("button queries take a pad index and a button name or index", () => {
  expect(gamepad.isButtonDown).type.toBeCallableWith(0, "A");
  expect(gamepad.wasButtonJustPressed).type.toBeCallableWith(3, 12);
  expect(gamepad.buttonValue(1, "RightTrigger")).type.toBe<number>();
  expect(gamepad.isButtonDown).type.not.toBeCallableWith(4, "A");
  expect(gamepad.isButtonDown).type.not.toBeCallableWith(0, "Jump");
  expect(gamepad.isButtonDown).type.not.toBeCallableWith(0, "LeftStickX");
});

test("axis queries take an axis name or index", () => {
  expect(gamepad.axisValue(0, "LeftStickX")).type.toBe<number>();
  expect(gamepad.wasAxisJustPressed).type.toBeCallableWith(0, 1, {
    autoRepeat: true,
    positive: true
  });
  expect(gamepad.axisValue).type.not.toBeCallableWith(0, "A");
  expect(gamepad.wasAxisJustReleased).type.not.toBeCallableWith(0, 1, {
    autoRepeat: true
  });
});

test("connection events carry the browser gamepad", () => {
  gamepad.on("connect", (pad) => {
    expect(pad).type.toBe<globalThis.Gamepad>();
  });
});
