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

    assert.deepEqual(map.chordsBoundTo("redo").map(String), ["Mod+Shift+y"]);
    assert.deepEqual(map.chordsBoundTo("undo").map(String), ["Mod+z"]);
  });

  test("an empty override leaves the action unbound", () => {
    const map = new KeyBindingMap(kDefaults, {
      remove: []
    });

    assert.deepEqual(map.chordsBoundTo("remove"), []);
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
        rebuilt.chordsBoundTo(action).map(String),
        map.chordsBoundTo(action).map(String)
      );
    }
  });

  test("rebind() and restore() return new maps and leave the source alone", () => {
    const map = new KeyBindingMap(kDefaults, { remove: [] });
    const rebound = map.rebind("undo", "Mod+u");

    assert.deepEqual(rebound.overrides, {
      undo: ["Mod+u"],
      remove: []
    });
    assert.deepEqual(rebound.restore("undo").overrides, { remove: [] });
    assert.deepEqual(rebound.restore().overrides, {});
    assert.deepEqual(map.overrides, { remove: [] });
  });

  test("format() labels every chord of an action", () => {
    const map = new KeyBindingMap(kDefaults);

    assert.deepEqual(
      map.format("redo", { apple: false }),
      ["Ctrl+Y", "Ctrl+Shift+Z"]
    );
  });

  test("bind() routes each chord to its action handler until released, and skips actions without one", () => {
    const map = new KeyBindingMap(kDefaults);
    const bindings = new KeyBindings();
    const calls: string[] = [];
    const release = map.bind(bindings, {
      undo: () => {
        calls.push("undo");
      },
      redo: () => {
        calls.push("redo");
      }
    });

    assert.equal(bindings.dispatch(keydown({ code: "KeyY", key: "y", ...kMod })), true);
    assert.equal(bindings.dispatch(keydown({ code: "KeyZ", key: "z", ...kMod })), true);
    assert.equal(bindings.dispatch(keydown({ code: "Delete", key: "Delete" })), false);
    release();
    assert.equal(bindings.dispatch(keydown({ code: "KeyY", key: "y", ...kMod })), false);

    assert.deepEqual(calls, ["redo", "undo"]);
  });
});

describe("Controls.KeyBindingMap.parse", () => {
  test("drops a corrupt entry with its reason and keeps the others", () => {
    const { keyBindings, dropped } = KeyBindingMap.parse(
      kDefaults,
      JSON.stringify({
        undo: ["Mod+u"],
        redo: 42,
        jump: "j",
        remove: "Mod+u"
      })
    );

    assert.deepEqual(keyBindings.overrides, { undo: ["Mod+u"] });
    assert.equal(dropped.length, 3);
    assert.match(dropped[0], /"redo": not a string or a list of strings/);
    assert.match(dropped[1], /"jump": unknown action/);
    assert.match(dropped[2], /"remove": Key chord "Mod\+u" is bound to both/);
  });

  test("drops a chord that is not in the canonical form", () => {
    const { keyBindings, dropped } = KeyBindingMap.parse(
      kDefaults,
      JSON.stringify({
        undo: "mod+u",
        remove: "Backspace"
      })
    );

    assert.equal(dropped.length, 1);
    assert.match(dropped[0], /"undo": Invalid key chord: "mod\+u"/);
    assert.deepEqual(keyBindings.overrides, { remove: ["Backspace"] });
  });

  test("drops every entry of a value that is not a JSON object", () => {
    for (const raw of ["{not json", "[]", "null"]) {
      const { keyBindings, dropped } = KeyBindingMap.parse(kDefaults, raw);

      assert.deepEqual(keyBindings.overrides, {});
      assert.deepEqual(dropped, [
        "Dropped the stored keybindings: not a JSON object"
      ]);
    }
  });
});
