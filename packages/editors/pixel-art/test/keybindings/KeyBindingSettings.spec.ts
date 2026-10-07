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
import type { PixelArtKeyBindings } from "../../src/keybindings/pixelArtKeyBindings.ts";

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
    assert.deepEqual(settings.bindingsOf("undo"), ["Mod+u"]);
  });

  test("drops a corrupt entry with a warning and keeps the others", () => {
    const storage = stored({
      undo: ["Mod+u"],
      redo: 42,
      jump: "j",
      copy: "Mod+u"
    });

    const { settings, warnings } = load(storage);

    assert.deepEqual(settings.keyBindings.overrides, { undo: ["Mod+u"] });
    assert.equal(warnings.length, 3);
    assert.match(warnings[0], /"redo": not a string or a list of strings/);
    assert.match(warnings[1], /"jump": unknown action/);
    assert.match(warnings[2], /"copy": Key chord "Mod\+u" is bound to both/);
    assert.deepEqual(storedValue(storage), { undo: ["Mod+u"] });
  });

  test("drops a stored chord that is not in the canonical form", () => {
    const storage = stored({
      undo: "mod+u",
      delete: "Backspace"
    });

    const { settings, warnings } = load(storage);

    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /"undo": Invalid key chord: "mod\+u"/);
    assert.deepEqual(storedValue(storage), { delete: ["Backspace"] });
    assert.deepEqual(settings.bindingsOf("undo"), ["Mod+z"]);
  });

  test("leaves the storage alone when every entry is current", () => {
    const raw = JSON.stringify({ undo: ["Mod+u"] });
    const storage = stored(raw);

    load(storage);

    assert.equal(storage.get(KEY_BINDINGS_STORAGE_KEY), raw);
  });

  test("drops a stored value that is not a JSON object", () => {
    const { settings, warnings } = load(stored("{not json"));

    assert.deepEqual(settings.keyBindings.overrides, {});
    assert.equal(warnings.length, 1);
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
      keyBindings: new KeyBindingSettings({ storage: new MemoryStorageAdapter() }).keyBindings
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
