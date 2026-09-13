// Import Third-party Dependencies
import {
  expect,
  test
} from "tstyche";

// Import Internal Dependencies
import type {
  Input,
  InputDevicePreference,
  InputListenerType
} from "../src/index.ts";

declare const input: Input;

test("input events carry typed payloads", () => {
  input.on("devicePreferenceChange", (preference) => {
    expect(preference).type.toBe<InputDevicePreference>();
  });

  expect(input.on).type.toBeCallableWith("exit", () => void 0);
  expect(input.on).type.not.toBeCallableWith("keyboard.down", () => void 0);
});

test("listener types are dot paths over devices and key codes", () => {
  expect<"mouse.down">().type.toBeAssignableTo<InputListenerType>();
  expect<"keyboard.KeyA">().type.toBeAssignableTo<InputListenerType>();
  expect<"keyboard.A">().type.not.toBeAssignableTo<InputListenerType>();
  expect<"mouse.click">().type.not.toBeAssignableTo<InputListenerType>();
});
