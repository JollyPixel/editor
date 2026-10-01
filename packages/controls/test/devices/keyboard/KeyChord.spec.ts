// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  KeyChord,
  type KeyChordEvent
} from "../../../src/index.ts";

function keydown(
  init: Partial<KeyChordEvent> & Pick<KeyChordEvent, "code">
): KeyChordEvent {
  return {
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...init
  };
}

describe("Controls.KeyChord", () => {
  test("parse() reads the modifiers and the physical code", () => {
    const chord = KeyChord.parse("Mod+Shift+KeyZ");

    assert.equal(chord.code, "KeyZ");
    assert.equal(chord.mod, true);
    assert.equal(chord.shift, true);
    assert.equal(chord.alt, false);
  });

  test("matches() requires the exact modifier set", () => {
    const chord = KeyChord.parse("Shift+KeyR");

    assert.equal(chord.matches(keydown({ code: "KeyR", shiftKey: true })), true);
    assert.equal(chord.matches(keydown({ code: "KeyR" })), false);
    assert.equal(
      chord.matches(keydown({ code: "KeyR", shiftKey: true, altKey: true })),
      false
    );
    assert.equal(chord.matches(keydown({ code: "KeyE", shiftKey: true })), false);
  });

  test("Mod is Meta on Apple platforms and Control elsewhere", () => {
    const chord = KeyChord.parse("Mod+KeyZ");
    const ctrl = keydown({ code: "KeyZ", ctrlKey: true });
    const meta = keydown({ code: "KeyZ", metaKey: true });

    assert.equal(chord.matches(ctrl, { apple: false }), true);
    assert.equal(chord.matches(meta, { apple: false }), false);
    assert.equal(chord.matches(meta, { apple: true }), true);
    assert.equal(chord.matches(ctrl, { apple: true }), false);
  });

  test("a chord without Mod rejects Control and Meta", () => {
    const chord = KeyChord.parse("KeyG");

    assert.equal(chord.matches(keydown({ code: "KeyG", ctrlKey: true })), false);
    assert.equal(chord.matches(keydown({ code: "KeyG", metaKey: true })), false);
  });

  test("format() writes a platform label", () => {
    const cases = [
      ["Mod+Shift+KeyZ", "Ctrl+Shift+Z", "⇧⌘Z"],
      ["Mod+Alt+Digit1", "Ctrl+Alt+1", "⌥⌘1"],
      ["BracketLeft", "[", "["],
      ["Escape", "Esc", "Esc"],
      ["NumpadEnter", "Enter", "Enter"],
      ["F2", "F2", "F2"]
    ] as const;

    for (const [chord, other, apple] of cases) {
      const parsed = KeyChord.parse(chord);

      assert.equal(parsed.format({ apple: false }), other);
      assert.equal(parsed.format({ apple: true }), apple);
    }
  });
});
