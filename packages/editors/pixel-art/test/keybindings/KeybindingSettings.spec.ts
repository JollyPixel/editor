// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { Keybindings } from "@jolly-pixel/pixel-draw.renderer";
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  KEYBINDINGS_STORAGE_KEY,
  KeybindingSettings
} from "../../src/keybindings/KeybindingSettings.ts";
import {
  applyKeybindings,
  type KeybindingCanvas,
  type KeybindingPanel
} from "../../src/keybindings/applyKeybindings.ts";

class FakePanel extends EventTarget implements KeybindingPanel {
  readonly textures: { canvas: KeybindingCanvas; }[];
  canvasManager: KeybindingCanvas;

  constructor(
    canvas: KeybindingCanvas
  ) {
    super();

    this.textures = [{ canvas }];
    this.canvasManager = canvas;
  }
}

function stored(
  value: unknown
): MemoryStorageAdapter {
  const storage = new MemoryStorageAdapter();
  storage.set(
    KEYBINDINGS_STORAGE_KEY,
    typeof value === "string" ? value : JSON.stringify(value)
  );

  return storage;
}

function load(
  storage: MemoryStorageAdapter
) {
  const warnings: string[] = [];
  const settings = new KeybindingSettings({
    storage,
    onDropped: (message) => warnings.push(message)
  });

  return {
    settings,
    warnings
  };
}

describe("KeybindingSettings", () => {
  test("stores only the difference from the defaults", () => {
    const storage = new MemoryStorageAdapter();
    const { settings } = load(storage);

    settings.assign("undo", ["mod+u"]);
    settings.assign("redo", ["mod+y", "mod+shift+z"]);

    assert.deepEqual(
      JSON.parse(storage.get(KEYBINDINGS_STORAGE_KEY)!),
      { undo: ["mod+u"] }
    );
  });

  test("drops a corrupt entry with a warning and keeps the others", () => {
    const storage = stored({
      undo: ["mod+u"],
      redo: 42,
      jump: "j",
      copy: "mod+u"
    });

    const { settings, warnings } = load(storage);

    assert.deepEqual(settings.overrides, { undo: ["mod+u"] });
    assert.equal(warnings.length, 3);
    assert.match(warnings[0], /"redo": not a string or a list of strings/);
    assert.match(warnings[1], /"jump": unknown action/);
    assert.match(warnings[2], /"copy": Keybinding "mod\+u" is already assigned/);
    assert.deepEqual(
      JSON.parse(storage.get(KEYBINDINGS_STORAGE_KEY)!),
      { undo: ["mod+u"] }
    );
  });

  test("drops a stored value that is not a JSON object", () => {
    const { settings, warnings } = load(stored("{not json"));

    assert.deepEqual(settings.overrides, {});
    assert.equal(warnings.length, 1);
  });

  test("a rejected assign leaves the bindings and storage unchanged", () => {
    const storage = new MemoryStorageAdapter();
    const { settings } = load(storage);

    assert.throws(() => settings.assign("copy", ["mod+z"]));

    assert.deepEqual(settings.overrides, {});
    assert.equal(storage.get(KEYBINDINGS_STORAGE_KEY), null);
  });
});

describe("applyKeybindings", () => {
  test("patches every texture on change and the new active one", () => {
    const { settings } = load(new MemoryStorageAdapter());
    const first = { keybindings: new Keybindings() };
    const second = { keybindings: new Keybindings() };
    const panel = new FakePanel(first);

    const detach = applyKeybindings(panel, settings);
    settings.assign("undo", ["mod+u"]);
    assert.deepEqual(first.keybindings.bindings.undo, ["mod+u"]);

    panel.textures.push({ canvas: second });
    panel.canvasManager = second;
    panel.dispatchEvent(new Event("texture-change"));
    assert.deepEqual(second.keybindings.bindings.undo, ["mod+u"]);

    detach();
    settings.reset();
    assert.deepEqual(first.keybindings.bindings.undo, ["mod+u"]);
  });
});
