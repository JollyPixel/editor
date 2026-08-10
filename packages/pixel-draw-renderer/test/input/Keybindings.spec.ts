// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  DEFAULT_KEYBINDINGS,
  Keybindings,
  parseKeybinding
} from "#src/input/Keybindings.ts";
import { InvalidKeybindingError } from "#src/input/errors/InvalidKeybindingError.ts";
import { KeybindingConflictError } from "#src/input/errors/KeybindingConflictError.ts";

function keydown(
  parameters: {
    key: string;
    code?: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
  }
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
      mod: true,
      shift: false,
      alt: false,
      key: "z"
    });
  });

  test("parses a multi-modifier combo", () => {
    assert.deepStrictEqual(parseKeybinding("mod+shift+z"), {
      mod: true,
      shift: true,
      alt: false,
      key: "z"
    });
  });

  test("parses a bare key with no modifier", () => {
    assert.deepStrictEqual(parseKeybinding("Delete"), {
      mod: false,
      shift: false,
      alt: false,
      key: "delete"
    });
  });

  test("lowercases the key token", () => {
    assert.strictEqual(
      parseKeybinding("mod+ArrowUp").key,
      "arrowup"
    );
  });

  test("throws InvalidKeybindingError on an unknown modifier", () => {
    assert.throws(
      () => parseKeybinding("ctl+z"),
      InvalidKeybindingError
    );
  });

  test("throws InvalidKeybindingError on a missing key segment", () => {
    assert.throws(
      () => parseKeybinding("mod+"),
      InvalidKeybindingError
    );
  });

  test("throws InvalidKeybindingError on an empty string", () => {
    assert.throws(
      () => parseKeybinding(""),
      InvalidKeybindingError
    );
  });

  test("throws InvalidKeybindingError on doubled separators", () => {
    assert.throws(
      () => parseKeybinding("mod++z"),
      InvalidKeybindingError
    );
  });
});

describe("Keybindings.match", () => {
  test("matches mod+letter regardless of Ctrl vs Cmd", () => {
    const keybindings = new Keybindings();

    assert.strictEqual(
      keybindings.match(keydown({
        key: "c",
        ctrlKey: true
      })),
      "copy"
    );
    assert.strictEqual(
      keybindings.match(keydown({
        key: "c",
        metaKey: true
      })),
      "copy"
    );
  });

  test("exact-match semantics: an extra held modifier prevents a match", () => {
    const keybindings = new Keybindings();

    assert.strictEqual(
      keybindings.match(keydown({
        key: "c",
        ctrlKey: true,
        shiftKey: true
      })),
      null
    );
  });

  test("undo (mod+z) and redo (mod+shift+z) are disambiguated by Shift", () => {
    const keybindings = new Keybindings();

    assert.strictEqual(
      keybindings.match(keydown({
        key: "z",
        ctrlKey: true
      })),
      "undo"
    );
    assert.strictEqual(
      keybindings.match(keydown({
        key: "Z",
        ctrlKey: true,
        shiftKey: true
      })),
      "redo"
    );
  });

  test("redo also matches its alternate trigger mod+y", () => {
    const keybindings = new Keybindings();

    assert.strictEqual(
      keybindings.match(keydown({
        key: "y",
        ctrlKey: true
      })),
      "redo"
    );
  });

  test("delete matches a bare Delete keydown, no modifier", () => {
    const keybindings = new Keybindings();

    assert.strictEqual(
      keybindings.match(keydown({
        key: "Delete"
      })),
      "delete"
    );
  });

  test("delete does not match when a modifier is additionally held (exact-match)", () => {
    const keybindings = new Keybindings();

    assert.strictEqual(
      keybindings.match(keydown({
        key: "Delete",
        ctrlKey: true
      })),
      null
    );
  });

  test("matches by the character produced (event.key), not physical key position — correct on AZERTY", () => {
    // AZERTY: the physical key that produces the "z" character sits where
    // QWERTY has "W", so the browser reports key: "z", code: "KeyW".
    const keybindings = new Keybindings();
    const azertyZ = keydown({
      key: "z",
      code: "KeyW",
      ctrlKey: true
    });

    assert.strictEqual(keybindings.match(azertyZ), "undo");
  });

  test("returns null when nothing matches", () => {
    const keybindings = new Keybindings();

    assert.strictEqual(
      keybindings.match(keydown({
        key: "q",
        ctrlKey: true
      })),
      null
    );
  });

  test("rotate matches a bare 'r' keydown, no modifier", () => {
    const keybindings = new Keybindings();

    assert.strictEqual(
      keybindings.match(keydown({ key: "r" })),
      "rotate"
    );
  });

  test("flipHorizontal matches a bare 'h' keydown, flipVertical matches a bare 'v' keydown", () => {
    const keybindings = new Keybindings();

    assert.strictEqual(
      keybindings.match(keydown({ key: "h" })),
      "flipHorizontal"
    );
    assert.strictEqual(
      keybindings.match(keydown({ key: "v" })),
      "flipVertical"
    );
  });

  test("rotate/flip do not match when a modifier is additionally held (exact-match)", () => {
    const keybindings = new Keybindings();

    assert.strictEqual(
      keybindings.match(keydown({
        key: "r",
        ctrlKey: true
      })),
      null
    );
  });
});

describe("Keybindings construction and patch", () => {
  test("constructor with no patch uses the defaults", () => {
    const keybindings = new Keybindings();

    assert.deepStrictEqual(
      keybindings.bindings,
      DEFAULT_KEYBINDINGS
    );
  });

  test("overridden actions take the new binding, others keep the default", () => {
    const keybindings = new Keybindings({ undo: "alt+z" });

    assert.strictEqual(
      keybindings.bindings.undo,
      "alt+z"
    );
    assert.strictEqual(
      keybindings.bindings.copy,
      DEFAULT_KEYBINDINGS.copy
    );
  });

  test("constructor throws KeybindingConflictError when two actions resolve to the same combo", () => {
    assert.throws(
      () => new Keybindings({
        delete: DEFAULT_KEYBINDINGS.copy as string
      }),
      KeybindingConflictError
    );
  });

  test("constructor throws InvalidKeybindingError when the patch contains a malformed binding", () => {
    assert.throws(
      () => new Keybindings({
        undo: "ctl+z" as never
      }),
      InvalidKeybindingError
    );
  });

  test("re-binding an action to one of its own alternate triggers is not a self-conflict", () => {
    const keybindings = new Keybindings({
      redo: "mod+y"
    });

    assert.strictEqual(keybindings.bindings.redo, "mod+y");
  });

  test("patch merges onto the current bindings at runtime", () => {
    const keybindings = new Keybindings();
    keybindings.patch({ copy: "alt+j" });

    assert.strictEqual(
      keybindings.bindings.copy,
      "alt+j"
    );
    assert.strictEqual(
      keybindings.bindings.undo,
      DEFAULT_KEYBINDINGS.undo
    );
  });

  test("patch throws on conflict and leaves the previous bindings in effect", () => {
    const keybindings = new Keybindings();

    assert.throws(
      () => keybindings.patch({ delete: "mod+c" }),
      KeybindingConflictError
    );
    assert.strictEqual(
      keybindings.bindings.delete,
      DEFAULT_KEYBINDINGS.delete
    );
  });
});
