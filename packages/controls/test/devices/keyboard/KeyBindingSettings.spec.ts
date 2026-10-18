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
  type KeyBindingMap,
  type KeyBindingStorage
} from "../../../src/index.ts";

// CONSTANTS
const kWindow = new Window();
const kStorageKey = "test:keybindings";
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

class MapStorage implements KeyBindingStorage {
  readonly entries = new Map<string, string>();

  get(
    key: string
  ): string | null {
    return this.entries.get(key) ?? null;
  }

  set(
    key: string,
    value: string
  ): void {
    this.entries.set(key, value);
  }

  stored(): unknown {
    const raw = this.get(kStorageKey);
    assert.ok(raw !== null);

    return JSON.parse(raw);
  }
}

function stored(
  value: unknown
): MapStorage {
  const storage = new MapStorage();
  storage.set(
    kStorageKey,
    typeof value === "string" ? value : JSON.stringify(value)
  );

  return storage;
}

function load(
  storage: MapStorage
) {
  const warnings: string[] = [];
  const settings = new KeyBindingSettings({
    defaults: kDefaults,
    storage,
    storageKey: kStorageKey,
    onDropped: (message) => warnings.push(message)
  });

  return {
    settings,
    warnings
  };
}

describe("Controls.KeyBindingSettings", () => {
  test("stores only the difference from the defaults", () => {
    const storage = new MapStorage();
    const { settings } = load(storage);

    settings.assign("undo", ["Mod+u"]);
    settings.assign("redo", ["Mod+y", "Mod+Shift+z"]);

    assert.deepEqual(storage.stored(), { undo: ["Mod+u"] });
    assert.deepEqual(settings.chordsBoundTo("undo"), ["Mod+u"]);
  });

  test("reports each dropped entry and rewrites the storage without it", () => {
    const storage = stored({
      undo: ["Mod+u"],
      jump: "j"
    });

    const { settings, warnings } = load(storage);

    assert.deepEqual(warnings, [
      "Dropped the stored keybinding \"jump\": unknown action"
    ]);
    assert.deepEqual(settings.keyBindings.overrides, { undo: ["Mod+u"] });
    assert.deepEqual(storage.stored(), { undo: ["Mod+u"] });
  });

  test("leaves the storage alone when every entry is current", () => {
    const raw = JSON.stringify({ undo: ["Mod+u"] });
    const storage = stored(raw);

    load(storage);

    assert.equal(storage.get(kStorageKey), raw);
  });

  test("a rejected assign leaves the bindings and storage unchanged", () => {
    const storage = new MapStorage();
    const { settings } = load(storage);
    const keyBindings = settings.keyBindings;

    assert.throws(
      () => settings.assign("copy", ["Mod+z"]),
      KeyChordConflictError
    );
    assert.throws(
      () => settings.assign("copy", ["ctrl+c"]),
      InvalidKeyChordError
    );

    assert.equal(settings.keyBindings, keyBindings);
    assert.equal(storage.get(kStorageKey), null);
  });

  test("emits the new map on every change", () => {
    const { settings } = load(stored({ undo: ["Mod+u"] }));
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
    const { settings } = load(stored({ undo: ["Mod+u"] }));
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

  test("sync() applies the current map and follows changes until released", () => {
    const { settings } = load(stored({ undo: ["Mod+u"] }));
    const initial = settings.keyBindings;
    const target = {
      keyBindings: initial.restore()
    };

    const release = settings.sync(target);
    assert.equal(target.keyBindings, initial);

    settings.assign("undo", ["Mod+j"]);
    assert.equal(target.keyBindings, settings.keyBindings);

    release();
    settings.reset();
    assert.notEqual(target.keyBindings, settings.keyBindings);
    assert.deepEqual(
      target.keyBindings.chordsBoundTo("undo").map(String),
      ["Mod+j"]
    );
  });
});
