// Import Node.js Dependencies
import { describe, test, before } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import {
  DEFAULT_KEYBINDINGS,
  InvalidKeybindingError,
  KeybindingConflictError,
  matchKeybindingAction,
  mergeKeybindings,
  parseKeybinding
} from "../../src/utils/keybindings.ts";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();

before(() => {
  globalThis.KeyboardEvent = (kEmulatedBrowserWindow as unknown as Record<string, unknown>).KeyboardEvent as typeof KeyboardEvent;
});

function keydown(
  parameters: { key: string; code?: string; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; altKey?: boolean; }
): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    key: parameters.key,
    code: parameters.code ?? parameters.key,
    ctrlKey: parameters.ctrlKey ?? false,
    metaKey: parameters.metaKey ?? false,
    shiftKey: parameters.shiftKey ?? false,
    altKey: parameters.altKey ?? false,
    bubbles: true
  });
}

describe("parseKeybinding", () => {
  test("parses a single-modifier combo", () => {
    assert.deepStrictEqual(parseKeybinding("mod+z"), {
      mod: true, shift: false, alt: false, key: "z"
    });
  });

  test("parses a multi-modifier combo", () => {
    assert.deepStrictEqual(parseKeybinding("mod+shift+z"), {
      mod: true, shift: true, alt: false, key: "z"
    });
  });

  test("parses a bare key with no modifier", () => {
    assert.deepStrictEqual(parseKeybinding("Delete"), {
      mod: false, shift: false, alt: false, key: "delete"
    });
  });

  test("lowercases the key token", () => {
    assert.strictEqual(parseKeybinding("mod+ArrowUp").key, "arrowup");
  });

  test("throws InvalidKeybindingError on an unknown modifier", () => {
    assert.throws(() => parseKeybinding("ctl+z"), InvalidKeybindingError);
  });

  test("throws InvalidKeybindingError on a missing key segment", () => {
    assert.throws(() => parseKeybinding("mod+"), InvalidKeybindingError);
  });

  test("throws InvalidKeybindingError on an empty string", () => {
    assert.throws(() => parseKeybinding(""), InvalidKeybindingError);
  });

  test("throws InvalidKeybindingError on doubled separators", () => {
    assert.throws(() => parseKeybinding("mod++z"), InvalidKeybindingError);
  });
});

describe("matchKeybindingAction", () => {
  test("matches mod+letter regardless of Ctrl vs Cmd", () => {
    assert.strictEqual(
      matchKeybindingAction(DEFAULT_KEYBINDINGS, keydown({ key: "c", ctrlKey: true })),
      "copy"
    );
    assert.strictEqual(
      matchKeybindingAction(DEFAULT_KEYBINDINGS, keydown({ key: "c", metaKey: true })),
      "copy"
    );
  });

  test("exact-match semantics: an extra held modifier prevents a match", () => {
    assert.strictEqual(
      matchKeybindingAction(DEFAULT_KEYBINDINGS, keydown({ key: "c", ctrlKey: true, shiftKey: true })),
      null
    );
  });

  test("undo (mod+z) and redo (mod+shift+z) are disambiguated by Shift", () => {
    assert.strictEqual(
      matchKeybindingAction(DEFAULT_KEYBINDINGS, keydown({ key: "z", ctrlKey: true })),
      "undo"
    );
    assert.strictEqual(
      matchKeybindingAction(DEFAULT_KEYBINDINGS, keydown({ key: "Z", ctrlKey: true, shiftKey: true })),
      "redo"
    );
  });

  test("redo also matches its alternate trigger mod+y", () => {
    assert.strictEqual(
      matchKeybindingAction(DEFAULT_KEYBINDINGS, keydown({ key: "y", ctrlKey: true })),
      "redo"
    );
  });

  test("delete matches a bare Delete keydown, no modifier", () => {
    assert.strictEqual(
      matchKeybindingAction(DEFAULT_KEYBINDINGS, keydown({ key: "Delete" })),
      "delete"
    );
  });

  test("delete does not match when a modifier is additionally held (exact-match)", () => {
    assert.strictEqual(
      matchKeybindingAction(DEFAULT_KEYBINDINGS, keydown({ key: "Delete", ctrlKey: true })),
      null
    );
  });

  test("matches by the character produced (event.key), not physical key position — correct on AZERTY", () => {
    // AZERTY: the physical key that produces the "z" character sits where
    // QWERTY has "W", so the browser reports key: "z", code: "KeyW".
    const azertyZ = keydown({ key: "z", code: "KeyW", ctrlKey: true });

    assert.strictEqual(matchKeybindingAction(DEFAULT_KEYBINDINGS, azertyZ), "undo");
  });

  test("returns null when nothing matches", () => {
    assert.strictEqual(
      matchKeybindingAction(DEFAULT_KEYBINDINGS, keydown({ key: "q", ctrlKey: true })),
      null
    );
  });
});

describe("mergeKeybindings", () => {
  test("overridden actions take the new binding, others keep the base", () => {
    const merged = mergeKeybindings(DEFAULT_KEYBINDINGS, { undo: "alt+z" });

    assert.strictEqual(merged.undo, "alt+z");
    assert.strictEqual(merged.copy, DEFAULT_KEYBINDINGS.copy);
  });

  test("throws KeybindingConflictError when two actions resolve to the same combo", () => {
    assert.throws(
      () => mergeKeybindings(DEFAULT_KEYBINDINGS, { delete: DEFAULT_KEYBINDINGS.copy as string }),
      KeybindingConflictError
    );
  });

  test("throws InvalidKeybindingError when the patch contains a malformed binding", () => {
    assert.throws(
      () => mergeKeybindings(DEFAULT_KEYBINDINGS, { undo: "ctl+z" as never }),
      InvalidKeybindingError
    );
  });

  test("re-binding an action to one of its own alternate triggers is not a self-conflict", () => {
    const merged = mergeKeybindings(DEFAULT_KEYBINDINGS, { redo: "mod+y" });

    assert.strictEqual(merged.redo, "mod+y");
  });
});
