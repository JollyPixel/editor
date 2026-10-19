// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { BoundChord } from "../../src/keybindings/BoundChord.ts";

function press(
  code: string,
  key: string,
  modifiers: Partial<Record<"ctrlKey" | "metaKey" | "shiftKey" | "altKey", boolean>> = {}
) {
  return {
    code,
    key,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...modifiers
  };
}

describe("BoundChord", () => {
  test("captures the printed letter, so a layout binds what its keys show", () => {
    assert.equal(BoundChord.capture(press("KeyQ", "a"))?.value, "a");
    assert.equal(
      BoundChord.capture(press("KeyZ", "Z", { ctrlKey: true, shiftKey: true }), {
        apple: false
      })?.value,
      "Mod+Shift+z"
    );
  });

  test("captures other keys by their code and Mod as Command on Apple", () => {
    assert.equal(
      BoundChord.capture(press("BracketLeft", "["), { apple: true })?.value,
      "BracketLeft"
    );
    assert.equal(
      BoundChord.capture(press("Delete", "Delete", { metaKey: true }), {
        apple: true
      })?.value,
      "Mod+Delete"
    );
  });

  test("ignores a lone modifier and keys no chord can name", () => {
    assert.equal(BoundChord.capture(press("ShiftLeft", "Shift")), null);
    assert.equal(BoundChord.capture(press("Unidentified", "Dead")), null);
  });

  test("labels a chord for the platform", () => {
    assert.equal(BoundChord.parse("Mod+Shift+z", { apple: false })?.label, "Ctrl+Shift+Z");
    assert.equal(BoundChord.parse("Mod+Shift+z", { apple: true })?.label, "⇧⌘Z");
    assert.equal(BoundChord.parse("Shift+Mod+z"), null);
  });
});
