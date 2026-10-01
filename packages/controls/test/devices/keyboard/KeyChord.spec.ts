// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  InvalidKeyChordError,
  KeyChord,
  type KeyChordEvent,
  type KeyChordString
} from "../../../src/index.ts";

function keydown(
  init: Partial<KeyChordEvent> & Pick<KeyChordEvent, "code">
): KeyChordEvent {
  return {
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    key: "",
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

  test("parse() reads a lowercase letter as a printed key", () => {
    const letter = KeyChord.parse("Mod+Shift+z");
    const code = KeyChord.parse("KeyZ");

    assert.equal(letter.key, "z");
    assert.equal(letter.code, null);
    assert.equal(letter.shift, true);
    assert.equal(code.key, null);
    assert.equal(code.code, "KeyZ");
  });

  test("a letter chord follows the printed key on any layout", () => {
    const undo = KeyChord.parse("Mod+z");
    const azertyZ = keydown({ code: "KeyW", key: "z", ctrlKey: true });
    const azertyW = keydown({ code: "KeyZ", key: "w", ctrlKey: true });
    const qwertzZ = keydown({ code: "KeyY", key: "z", ctrlKey: true });
    const azertyM = keydown({ code: "Semicolon", key: "m" });

    assert.equal(undo.matches(azertyZ, { apple: false }), true);
    assert.equal(undo.matches(azertyW, { apple: false }), false);
    assert.equal(undo.matches(qwertzZ, { apple: false }), true);
    assert.equal(KeyChord.parse("m").matches(azertyM), true);
  });

  test("a letter chord ignores case and keeps Shift as a modifier", () => {
    const undo = KeyChord.parse("Mod+z");
    const redo = KeyChord.parse("Mod+Shift+z");
    const shifted = keydown({
      code: "KeyZ",
      key: "Z",
      ctrlKey: true,
      shiftKey: true
    });
    const capsLock = keydown({ code: "KeyZ", key: "Z", ctrlKey: true });

    assert.equal(redo.matches(shifted, { apple: false }), true);
    assert.equal(undo.matches(shifted, { apple: false }), false);
    assert.equal(undo.matches(capsLock, { apple: false }), true);
  });

  test("a letter chord falls back to the code without an ASCII letter", () => {
    const cases = [
      ["Mod+z", keydown({ code: "KeyZ", key: "я", ctrlKey: true }), true],
      ["Alt+z", keydown({ code: "KeyZ", key: "Ω", altKey: true }), true],
      ["e", keydown({ code: "KeyE", key: "Dead" }), true],
      ["a", keydown({ code: "Digit1", key: "&" }), false],
      ["a", keydown({ code: "KeyQ", key: "a" }), true]
    ] as const;

    for (const [chord, event, expected] of cases) {
      assert.equal(
        KeyChord.parse(chord).matches(event, { apple: false }),
        expected,
        `${chord} against ${event.code}/${event.key}`
      );
    }
  });

  test("format() writes a letter chord as its uppercase letter", () => {
    const chord = KeyChord.parse("Mod+Shift+z");
    const layout = new Map([["KeyZ", "w"]]);

    assert.equal(chord.format({ apple: false, layout }), "Ctrl+Shift+Z");
    assert.equal(chord.format({ apple: true }), "⇧⌘Z");
  });

  test("format() names a code by the character the layout prints", () => {
    const layout = new Map([
      ["KeyQ", "a"],
      ["KeyW", "й"],
      ["KeyX", "ab"],
      ["KeyC", " "],
      ["Digit1", "&"],
      ["BracketLeft", "^"],
      ["Escape", "x"]
    ]);
    const cases = [
      ["Mod+KeyQ", "Ctrl+A"],
      ["KeyW", "Й"],
      ["KeyX", "X"],
      ["KeyC", "C"],
      ["KeyE", "E"],
      ["Digit1", "1"],
      ["BracketLeft", "^"],
      ["Escape", "Esc"]
    ] as const;

    for (const [chord, label] of cases) {
      assert.equal(KeyChord.parse(chord).format({ apple: false, layout }), label);
    }
  });

  test("from() accepts every chord that parse() reads", () => {
    for (const value of ["Mod+Shift+Alt+z", "KeyQ", "Shift+Delete", "Digit1"]) {
      assert.equal(KeyChord.from(value).toString(), value);
    }
  });

  test("from() rejects unknown keys, modifiers, and orderings", () => {
    const invalid = [
      "",
      "mod+z",
      "Mod+Z",
      "Mod+",
      "Ctrl+z",
      "Shift+Mod+z",
      "Mod+Mod+z",
      "Space+z",
      "NotAKey"
    ];

    for (const value of invalid) {
      assert.throws(
        () => KeyChord.from(value),
        (error) => error instanceof InvalidKeyChordError && error.chord === value
      );
    }
  });

  test("parse() rejects a string cast past its type like from()", () => {
    assert.throws(
      () => KeyChord.parse("mod+z" as KeyChordString),
      InvalidKeyChordError
    );
  });

  test("toString() writes the canonical chord", () => {
    assert.equal(
      new KeyChord({ alt: true, mod: true, key: "z" }).toString(),
      "Mod+Alt+z"
    );
    assert.equal(new KeyChord({ code: "Space" }).toString(), "Space");
  });
});
