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
import {
  keybindConsole,
  parseBindingList
} from "../../src/keybindings/keybindConsole.ts";

function boot(
  storage: MemoryStorageAdapter
) {
  const commands = new CommandConsole();
  const keyBindingSettings = new KeyBindingSettings({ storage });
  keybindConsole(commands, { keyBindingSettings });

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
  test("registers one variable per action and a reset command", () => {
    const { commands } = boot(new MemoryStorageAdapter());
    const namespace = commands.registry.namespace("keybind");

    assert.equal([...namespace!.variables()].length, 9);
    assert.notEqual(commands.registry.resolveCommand("keybind.reset"), undefined);
  });

  test("a read prints the bindings as a comma-separated list", async() => {
    const { commands } = boot(new MemoryStorageAdapter());

    await commands.submit("keybind.redo");

    assert.equal(lastLine(commands), "info: Mod+y, Mod+Shift+z");
  });

  test("a write survives a reboot on the same storage", async() => {
    const storage = new MemoryStorageAdapter();
    const first = boot(storage);

    await first.commands.submit("keybind.undo \"Mod+u\"");
    await first.commands.submit("keybind.redo \"Mod+y, Mod+Shift+u\"");
    assert.equal(lastLine(first.commands), "info: Mod+y, Mod+Shift+u");

    const second = boot(storage);
    assert.deepEqual(second.keyBindingSettings.keyBindings.overrides, {
      undo: ["Mod+u"],
      redo: ["Mod+y", "Mod+Shift+u"]
    });
    assert.deepEqual(second.keyBindingSettings.bindingsOf("undo"), ["Mod+u"]);
  });

  test("a conflict prints the KeyChordConflictError message and stores nothing", async() => {
    const storage = new MemoryStorageAdapter();
    const { commands, keyBindingSettings } = boot(storage);

    await commands.submit("keybind.copy \"Mod+z\"");

    assert.equal(
      lastLine(commands),
      "error: Key chord \"Mod+z\" is bound to both \"copy\" and \"undo\""
    );
    assert.deepEqual(keyBindingSettings.bindingsOf("copy"), ["Mod+c"]);
    assert.equal(storage.get(KEY_BINDINGS_STORAGE_KEY), null);
  });

  test("an empty value unbinds the action", async() => {
    const { commands, keyBindingSettings } = boot(new MemoryStorageAdapter());

    await commands.submit("keybind.delete \"\"");

    assert.deepEqual(keyBindingSettings.bindingsOf("delete"), []);
    assert.deepEqual(keyBindingSettings.keyBindings.overrides, { delete: [] });
  });

  test("a malformed binding prints the InvalidKeyChordError message", async() => {
    const { commands } = boot(new MemoryStorageAdapter());

    await commands.submit("keybind.undo \"mod+z\"");

    assert.equal(lastLine(commands), "error: Invalid key chord: \"mod+z\"");
  });

  test("/keybind.reset restores one action and clears its stored entry", async() => {
    const storage = new MemoryStorageAdapter();
    const { commands, keyBindingSettings } = boot(storage);
    await commands.submit("keybind.undo \"Mod+u\"");
    await commands.submit("keybind.delete \"Backspace\"");

    await commands.submit("/keybind.reset undo");

    assert.equal(lastLine(commands), "info: undo restored to Mod+z");
    assert.deepEqual(keyBindingSettings.keyBindings.overrides, { delete: ["Backspace"] });
    assert.deepEqual(
      JSON.parse(storage.get(KEY_BINDINGS_STORAGE_KEY)!),
      { delete: ["Backspace"] }
    );
  });

  test("/keybind.reset without an action restores every shortcut", async() => {
    const storage = new MemoryStorageAdapter();
    const { commands, keyBindingSettings } = boot(storage);
    await commands.submit("keybind.undo \"Mod+u\"");
    await commands.submit("keybind.delete \"Backspace\"");

    await commands.submit("/keybind.reset");

    assert.equal(lastLine(commands), "info: Every shortcut restored");
    assert.deepEqual(keyBindingSettings.keyBindings.overrides, {});
    assert.deepEqual(JSON.parse(storage.get(KEY_BINDINGS_STORAGE_KEY)!), {});
  });
});

describe("parseBindingList", () => {
  test("splits on commas, trims and skips empty items", () => {
    assert.deepEqual(
      parseBindingList(" Mod+y ,Mod+Shift+z,, "),
      ["Mod+y", "Mod+Shift+z"]
    );
    assert.deepEqual(parseBindingList(""), []);
  });
});
