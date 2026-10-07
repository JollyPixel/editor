// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import {
  InvalidKeyChordError,
  KeyChordConflictError
} from "@jolly-pixel/controls";
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  KEY_BINDINGS_STORAGE_KEY,
  KeyBindingSettings
} from "../../src/keybindings/KeyBindingSettings.ts";
import { PixelArtKeyBindings } from "../../src/keybindings/PixelArtKeyBindings.ts";

function stored(
  value: unknown
): MemoryStorageAdapter {
  const storage = new MemoryStorageAdapter();
  storage.set(
    KEY_BINDINGS_STORAGE_KEY,
    typeof value === "string" ? value : JSON.stringify(value)
  );

  return storage;
}

function load(
  storage: MemoryStorageAdapter
) {
  const warnings: string[] = [];
  const settings = new KeyBindingSettings({
    storage,
    onDropped: (message) => warnings.push(message)
  });

  return {
    settings,
    warnings
  };
}

function storedValue(
  storage: MemoryStorageAdapter
): unknown {
  const raw = storage.get(KEY_BINDINGS_STORAGE_KEY);
  assert.ok(raw !== null);

  return JSON.parse(raw);
}

describe("KeyBindingSettings", () => {
  test("stores only the difference from the defaults", () => {
    const storage = new MemoryStorageAdapter();
    const { settings } = load(storage);

    settings.assign("undo", ["Mod+u"]);
    settings.assign("redo", ["Mod+y", "Mod+Shift+z"]);

    assert.deepEqual(storedValue(storage), { undo: ["Mod+u"] });
    assert.deepEqual(settings.chordsBoundTo("undo"), ["Mod+u"]);
  });

  test("reports each dropped entry and rewrites the storage without it", () => {
    const storage = stored({
      undo: ["Mod+u"],
      jump: "j"
    });

    const { settings, warnings } = load(storage);

    assert.deepEqual(warnings, ["Dropped the stored keybinding \"jump\": unknown action"]);
    assert.deepEqual(settings.keyBindings.overrides, { undo: ["Mod+u"] });
    assert.deepEqual(storedValue(storage), { undo: ["Mod+u"] });
  });

  test("leaves the storage alone when every entry is current", () => {
    const raw = JSON.stringify({ undo: ["Mod+u"] });
    const storage = stored(raw);

    load(storage);

    assert.equal(storage.get(KEY_BINDINGS_STORAGE_KEY), raw);
  });

  test("a rejected assign leaves the bindings and storage unchanged", () => {
    const storage = new MemoryStorageAdapter();
    const { settings } = load(storage);
    const keyBindings = settings.keyBindings;

    assert.throws(() => settings.assign("copy", ["Mod+z"]), KeyChordConflictError);
    assert.throws(() => settings.assign("copy", ["ctrl+c"]), InvalidKeyChordError);

    assert.equal(settings.keyBindings, keyBindings);
    assert.equal(storage.get(KEY_BINDINGS_STORAGE_KEY), null);
  });

  test("emits the new map on every change", () => {
    const { settings } = load(stored({ undo: ["Mod+u"] }));
    const received: PixelArtKeyBindings[] = [];
    settings.on("change", (keyBindings) => received.push(keyBindings));

    settings.assign("undo", ["Mod+j"]);
    settings.reset();

    assert.equal(received.length, 2);
    assert.equal(received[1], settings.keyBindings);
    assert.deepEqual(received[0].chordsOf("undo").map(String), ["Mod+j"]);
    assert.deepEqual(received[1].chordsOf("undo").map(String), ["Mod+z"]);
  });

  test("bind applies the current map and follows changes until released", () => {
    const { settings } = load(stored({ undo: ["Mod+u"] }));
    const initial = settings.keyBindings;
    const target = {
      keyBindings: new PixelArtKeyBindings()
    };

    const release = settings.bind(target);
    assert.equal(target.keyBindings, initial);

    settings.assign("undo", ["Mod+j"]);
    assert.equal(target.keyBindings, settings.keyBindings);

    release();
    settings.reset();
    assert.notEqual(target.keyBindings, settings.keyBindings);
    assert.deepEqual(target.keyBindings.chordsOf("undo").map(String), ["Mod+j"]);
  });
});
