// Import Third-party Dependencies
import {
  expect,
  test
} from "tstyche";

// Import Internal Dependencies
import {
  KeyChord,
  type KeyChordLetter,
  type KeyCode,
  type KeyboardLayout,
  loadKeyboardLayout
} from "../../../src/index.ts";

test("a chord targets either a code or a letter", () => {
  expect(KeyChord).type.toBeConstructableWith({ code: "KeyZ" });
  expect(KeyChord).type.toBeConstructableWith({ key: "z", mod: true });
  expect(KeyChord).type.not.toBeConstructableWith({ code: "KeyZ", key: "z" });
  expect(KeyChord).type.not.toBeConstructableWith({ mod: true });
  expect(KeyChord).type.not.toBeConstructableWith({ key: "Z" });
});

test("a chord exposes both targets as nullable fields", () => {
  const chord = KeyChord.parse("Mod+z");

  expect(chord.key).type.toBe<KeyChordLetter | null>();
  expect(chord.code).type.toBe<KeyCode | null>();
});

test("format() accepts a layout map", () => {
  const chord = KeyChord.parse("KeyQ");

  expect(chord.format).type.toBeCallableWith({ layout: new Map<string, string>() });
  expect(loadKeyboardLayout()).type.toBe<Promise<KeyboardLayout | null>>();
});
