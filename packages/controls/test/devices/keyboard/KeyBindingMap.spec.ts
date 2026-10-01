// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import {
  InvalidKeyChordError,
  isApplePlatform,
  KeyBindingMap,
  KeyBindings,
  KeyChordConflictError,
  type KeyBindingDefaults
} from "../../../src/index.ts";

// CONSTANTS
const kWindow = new Window();
const kDefaults = {
  undo: "Mod+z",
  redo: ["Mod+y", "Mod+Shift+z"],
  remove: "Delete"
} as const satisfies KeyBindingDefaults<string>;
const kMod = isApplePlatform() ?
  { metaKey: true } :
  { ctrlKey: true };

function keydown(
  init: Pick<KeyboardEventInit, "code" | "key" | "ctrlKey" | "metaKey">
): KeyboardEvent {
  return new kWindow.KeyboardEvent("keydown", {
    cancelable: true,
    ...init
  }) as unknown as KeyboardEvent;
}

describe("Controls.KeyBindingMap", () => {
  test("lists the actions of the defaults in declaration order", () => {
    const map = new KeyBindingMap(kDefaults);

    assert.deepEqual(map.actions, ["undo", "redo", "remove"]);
  });

  test("an override replaces every default chord of its action", () => {
    const map = new KeyBindingMap(kDefaults, {
      redo: "Mod+Shift+y"
    });

    assert.deepEqual(map.chordsOf("redo").map(String), ["Mod+Shift+y"]);
    assert.deepEqual(map.chordsOf("undo").map(String), ["Mod+z"]);
  });

  test("an empty override leaves the action unbound", () => {
    const map = new KeyBindingMap(kDefaults, {
      remove: []
    });

    assert.deepEqual(map.chordsOf("remove"), []);
  });

  test("rejects an override that is not a key chord", () => {
    assert.throws(
      () => new KeyBindingMap(kDefaults, { undo: "mod+u" }),
      InvalidKeyChordError
    );
  });

  test("rejects a chord bound to two actions", () => {
    assert.throws(
      () => new KeyBindingMap(kDefaults, { undo: "Mod+y" }),
      (error) => error instanceof KeyChordConflictError &&
        error.chord === "Mod+y" &&
        error.actions[0] === "undo" &&
        error.actions[1] === "redo"
    );
  });

  test("overrides lists only the actions that differ from the defaults", () => {
    const map = new KeyBindingMap(kDefaults, {
      undo: "Mod+z",
      redo: ["Mod+y"],
      remove: []
    });

    assert.deepEqual(map.overrides, {
      redo: ["Mod+y"],
      remove: []
    });
  });

  test("a map rebuilt from its overrides has the same chords", () => {
    const map = new KeyBindingMap(kDefaults, { undo: ["Mod+u", "KeyU"] });
    const rebuilt = new KeyBindingMap(kDefaults, map.overrides);

    for (const action of map.actions) {
      assert.deepEqual(
        rebuilt.chordsOf(action).map(String),
        map.chordsOf(action).map(String)
      );
    }
  });

  test("format() labels every chord of an action", () => {
    const map = new KeyBindingMap(kDefaults);

    assert.deepEqual(
      map.format("redo", { apple: false }),
      ["Ctrl+Y", "Ctrl+Shift+Z"]
    );
  });

  test("bind() routes each chord to its action handler until released", () => {
    const map = new KeyBindingMap(kDefaults);
    const bindings = new KeyBindings();
    const calls: string[] = [];
    const release = map.bind(bindings, {
      undo: () => {
        calls.push("undo");
      },
      redo: () => {
        calls.push("redo");
      },
      remove: () => false
    });

    assert.equal(bindings.dispatch(keydown({ code: "KeyY", key: "y", ...kMod })), true);
    assert.equal(bindings.dispatch(keydown({ code: "KeyZ", key: "z", ...kMod })), true);
    assert.equal(bindings.dispatch(keydown({ code: "Delete", key: "Delete" })), false);
    release();
    assert.equal(bindings.dispatch(keydown({ code: "KeyY", key: "y", ...kMod })), false);

    assert.deepEqual(calls, ["redo", "undo"]);
  });
});
