// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { CommandConsole } from "@jolly-pixel/console";
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  KEY_BINDINGS_STORAGE_KEY,
  KeyBindingSettings
} from "../../src/keybindings/KeyBindingSettings.ts";
import { pixelArtConsole } from "../../src/console/pixelArtConsole.ts";

function boot(
  storage: MemoryStorageAdapter
) {
  const commands = new CommandConsole();
  const keyBindingSettings = new KeyBindingSettings({ storage });
  pixelArtConsole(commands, { keyBindingSettings });

  return {
    commands,
    keyBindingSettings
  };
}

function lastLine(
  commands: CommandConsole
): string {
  const entry = commands.scrollback.at(-1);

  return `${entry?.kind}: ${entry?.text}`;
}

describe("keybind console", () => {
  test("exposes the Select All binding and a reset command", async() => {
    const { commands } = boot(new MemoryStorageAdapter());
    await commands.submit("pixelart.keybinds.selectAll");

    assert.equal(lastLine(commands), "info: Mod+a");
    assert.notEqual(commands.registry.resolveCommand("pixelart.keybinds.reset"), undefined);
  });

  test("a read prints every binding of the action", async() => {
    const { commands } = boot(new MemoryStorageAdapter());

    await commands.submit("pixelart.keybinds.redo");

    assert.equal(lastLine(commands), "info: Mod+y Mod+Shift+z");
  });

  test("a write survives a reboot on the same storage", async() => {
    const storage = new MemoryStorageAdapter();
    const first = boot(storage);

    await first.commands.submit("pixelart.keybinds.undo \"Mod+u\"");
    await first.commands.submit("pixelart.keybinds.redo Mod+y Mod+Shift+u");
    assert.equal(lastLine(first.commands), "info: Mod+y Mod+Shift+u");

    const second = boot(storage);
    assert.deepEqual(second.keyBindingSettings.keyBindings.overrides, {
      undo: ["Mod+u"],
      redo: ["Mod+y", "Mod+Shift+u"]
    });
    assert.deepEqual(second.keyBindingSettings.chordsBoundTo("undo"), ["Mod+u"]);
  });

  test("a conflict prints the KeyChordConflictError message and stores nothing", async() => {
    const storage = new MemoryStorageAdapter();
    const { commands, keyBindingSettings } = boot(storage);

    await commands.submit("pixelart.keybinds.copy \"Mod+z\"");

    assert.equal(
      lastLine(commands),
      "error: Key chord \"Mod+z\" is bound to both \"copy\" and \"undo\""
    );
    assert.deepEqual(keyBindingSettings.chordsBoundTo("copy"), ["Mod+c"]);
    assert.equal(storage.get(KEY_BINDINGS_STORAGE_KEY), null);
  });

  test("an empty value unbinds the action", async() => {
    const { commands, keyBindingSettings } = boot(new MemoryStorageAdapter());

    await commands.submit("pixelart.keybinds.delete \"\"");

    assert.deepEqual(keyBindingSettings.chordsBoundTo("delete"), []);
    assert.deepEqual(keyBindingSettings.keyBindings.overrides, { delete: [] });
  });

  test("a malformed binding prints the InvalidKeyChordError message", async() => {
    const { commands } = boot(new MemoryStorageAdapter());

    await commands.submit("pixelart.keybinds.undo \"mod+z\"");

    assert.equal(lastLine(commands), "error: Invalid key chord: \"mod+z\"");
  });

  test("/pixelart.keybinds.reset restores one action and clears its stored entry", async() => {
    const storage = new MemoryStorageAdapter();
    const { commands, keyBindingSettings } = boot(storage);
    await commands.submit("pixelart.keybinds.undo \"Mod+u\"");
    await commands.submit("pixelart.keybinds.delete \"Backspace\"");

    await commands.submit("/pixelart.keybinds.reset undo");

    assert.equal(lastLine(commands), "info: undo restored to Mod+z");
    assert.deepEqual(keyBindingSettings.keyBindings.overrides, { delete: ["Backspace"] });
    assert.deepEqual(
      JSON.parse(storage.get(KEY_BINDINGS_STORAGE_KEY)!),
      { delete: ["Backspace"] }
    );
  });

  test("/pixelart.keybinds.reset without an action restores every shortcut", async() => {
    const storage = new MemoryStorageAdapter();
    const { commands, keyBindingSettings } = boot(storage);
    await commands.submit("pixelart.keybinds.undo \"Mod+u\"");
    await commands.submit("pixelart.keybinds.delete \"Backspace\"");

    await commands.submit("/pixelart.keybinds.reset");

    assert.equal(lastLine(commands), "info: Every shortcut restored");
    assert.deepEqual(keyBindingSettings.keyBindings.overrides, {});
    assert.deepEqual(JSON.parse(storage.get(KEY_BINDINGS_STORAGE_KEY)!), {});
  });
});
