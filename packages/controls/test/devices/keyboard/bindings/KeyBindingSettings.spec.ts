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
  KeyBindings,
  KeyBindingSettings,
  KeyChordConflictError,
  type KeyBindingDefaults,
  type KeyBindingMap
} from "../../../../src/index.ts";

// CONSTANTS
const kWindow = new Window();
const kDefaults = {
  undo: "Mod+z",
  redo: ["Mod+y", "Mod+Shift+z"],
  copy: "Mod+c"
} as const satisfies KeyBindingDefaults<string>;
const kMod = isApplePlatform() ?
  { metaKey: true } :
  { ctrlKey: true };

function keydown(
  letter: string
): KeyboardEvent {
  return new kWindow.KeyboardEvent("keydown", {
    cancelable: true,
    code: `Key${letter.toUpperCase()}`,
    key: letter,
    ...kMod
  }) as unknown as KeyboardEvent;
}

function load(
  overrides: unknown = {}
) {
  const warnings: string[] = [];
  const settings = new KeyBindingSettings({
    defaults: kDefaults,
    overrides,
    onDropped: (message) => warnings.push(message)
  });

  return {
    settings,
    warnings
  };
}

describe("Controls.KeyBindingSettings", () => {
  test("starts from the overrides and reports each dropped entry", () => {
    const { settings, warnings } = load({
      undo: ["Mod+u"],
      jump: "j"
    });

    assert.deepEqual(warnings, [
      "Dropped the stored keybinding \"jump\": unknown action"
    ]);
    assert.deepEqual(settings.chordsBoundTo("undo"), ["Mod+u"]);
  });

  test("a rejected assign leaves the bindings unchanged and emits nothing", () => {
    const { settings } = load();
    const keyBindings = settings.keyBindings;
    let changes = 0;
    settings.on("change", () => changes++);

    assert.throws(
      () => settings.assign("copy", ["Mod+z"]),
      KeyChordConflictError
    );
    assert.throws(
      () => settings.assign("copy", ["ctrl+c"]),
      InvalidKeyChordError
    );

    assert.equal(settings.keyBindings, keyBindings);
    assert.equal(changes, 0);
  });

  test("load() swaps two chords in a single change", () => {
    const { settings } = load();
    const received: KeyBindingMap<keyof typeof kDefaults>[] = [];
    settings.on("change", (keyBindings) => received.push(keyBindings));

    settings.load({
      undo: ["Mod+c"],
      copy: ["Mod+z"]
    });

    assert.equal(received.length, 1);
    assert.deepEqual(settings.chordsBoundTo("undo"), ["Mod+c"]);
    assert.deepEqual(settings.chordsBoundTo("copy"), ["Mod+z"]);
  });

  test("load() of the current bindings emits nothing", () => {
    const { settings } = load({ undo: ["Mod+u"] });
    let changes = 0;
    settings.on("change", () => changes++);

    settings.load({
      undo: ["Mod+u"],
      redo: ["Mod+y", "Mod+Shift+z"]
    });

    assert.equal(changes, 0);
  });

  test("emits the new map on every change", () => {
    const { settings } = load({ undo: ["Mod+u"] });
    const received: KeyBindingMap<keyof typeof kDefaults>[] = [];
    settings.on("change", (keyBindings) => received.push(keyBindings));

    settings.assign("undo", ["Mod+j"]);
    settings.reset();

    assert.equal(received.length, 2);
    assert.equal(received[1], settings.keyBindings);
    assert.deepEqual(received[0].chordsBoundTo("undo").map(String), ["Mod+j"]);
    assert.deepEqual(received[1].chordsBoundTo("undo").map(String), ["Mod+z"]);
  });

  test("bind() routes the current chords and follows changes until released", () => {
    const { settings } = load({ undo: ["Mod+u"] });
    const bindings = new KeyBindings();
    const calls: string[] = [];
    const release = settings.bind(bindings, {
      undo: () => {
        calls.push("undo");
      }
    });

    bindings.dispatch(keydown("u"));
    settings.assign("undo", ["Mod+j"]);
    bindings.dispatch(keydown("u"));
    bindings.dispatch(keydown("j"));
    release();
    bindings.dispatch(keydown("j"));

    assert.deepEqual(calls, ["undo", "undo"]);
  });
});
