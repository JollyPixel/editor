// Import Third-party Dependencies
import {
  expect,
  test
} from "tstyche";

// Import Internal Dependencies
import {
  KeyBindingMap,
  KeyBindings
} from "../../../src/index.ts";

const map = new KeyBindingMap({
  undo: "Mod+z",
  redo: ["Mod+y", "Mod+Shift+z"]
});

test("actions are inferred from the defaults", () => {
  expect(map.actions).type.toBe<readonly ("undo" | "redo")[]>();
  expect(map.chordsOf).type.not.toBeCallableWith("paste");
});

test("defaults are typed chords while overrides are untrusted strings", () => {
  expect(KeyBindingMap).type.not.toBeConstructableWith({ undo: "mod+z" });
  expect(KeyBindingMap).type.toBeConstructableWith(
    { undo: "Mod+z" },
    { undo: "anything" }
  );
});

test("bind() requires a handler for every action", () => {
  const bindings = new KeyBindings();

  expect(map.bind).type.toBeCallableWith(bindings, {
    undo: () => true,
    redo: () => undefined
  });
  expect(map.bind).type.not.toBeCallableWith(bindings, {
    undo: () => true
  });
});
