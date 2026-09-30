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
  KEYBINDINGS_STORAGE_KEY,
  KeybindingSettings
} from "../../src/keybindings/KeybindingSettings.ts";
import {
  keybindConsole,
  parseBindingList
} from "../../src/keybindings/keybindConsole.ts";

function boot(
  storage: MemoryStorageAdapter
) {
  const commands = new CommandConsole();
  const keybindings = new KeybindingSettings({ storage });
  keybindConsole(commands, { keybindings });

  return {
    commands,
    keybindings
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

    assert.equal(lastLine(commands), "info: mod+y, mod+shift+z");
  });

  test("a write survives a reboot on the same storage", async() => {
    const storage = new MemoryStorageAdapter();
    const first = boot(storage);

    await first.commands.submit("keybind.undo \"mod+u\"");
    await first.commands.submit("keybind.redo \"mod+y, mod+shift+u\"");
    assert.equal(lastLine(first.commands), "info: mod+y, mod+shift+u");

    const second = boot(storage);
    assert.deepEqual(second.keybindings.overrides, {
      undo: ["mod+u"],
      redo: ["mod+y", "mod+shift+u"]
    });
    assert.deepEqual(second.keybindings.bindings.undo, ["mod+u"]);
  });

  test("a conflict prints the KeybindingConflictError message and stores nothing", async() => {
    const storage = new MemoryStorageAdapter();
    const { commands, keybindings } = boot(storage);

    await commands.submit("keybind.copy \"mod+z\"");

    assert.equal(
      lastLine(commands),
      "error: Keybinding \"mod+z\" is already assigned to \"copy\" (conflicts with \"undo\")"
    );
    assert.deepEqual(keybindings.bindingsOf("copy"), ["mod+c"]);
    assert.equal(storage.get(KEYBINDINGS_STORAGE_KEY), null);
  });

  test("an empty value unbinds the action", async() => {
    const { commands, keybindings } = boot(new MemoryStorageAdapter());

    await commands.submit("keybind.delete \"\"");

    assert.deepEqual(keybindings.bindingsOf("delete"), []);
    assert.deepEqual(keybindings.overrides, { delete: [] });
  });

  test("a malformed binding prints the InvalidKeybindingError message", async() => {
    const { commands } = boot(new MemoryStorageAdapter());

    await commands.submit("keybind.undo \"ctrl+z\"");

    assert.equal(lastLine(commands), "error: Invalid keybinding: \"ctrl+z\"");
  });

  test("/keybind.reset restores one action and clears its stored entry", async() => {
    const storage = new MemoryStorageAdapter();
    const { commands, keybindings } = boot(storage);
    await commands.submit("keybind.undo \"mod+u\"");
    await commands.submit("keybind.delete \"Backspace\"");

    await commands.submit("/keybind.reset undo");

    assert.equal(lastLine(commands), "info: undo restored to mod+z");
    assert.deepEqual(keybindings.overrides, { delete: ["Backspace"] });
    assert.deepEqual(
      JSON.parse(storage.get(KEYBINDINGS_STORAGE_KEY)!),
      { delete: ["Backspace"] }
    );
  });

  test("/keybind.reset without an action restores every shortcut", async() => {
    const storage = new MemoryStorageAdapter();
    const { commands, keybindings } = boot(storage);
    await commands.submit("keybind.undo \"mod+u\"");
    await commands.submit("keybind.delete \"Backspace\"");

    await commands.submit("/keybind.reset");

    assert.equal(lastLine(commands), "info: Every shortcut restored");
    assert.deepEqual(keybindings.overrides, {});
    assert.deepEqual(JSON.parse(storage.get(KEYBINDINGS_STORAGE_KEY)!), {});
  });
});

describe("parseBindingList", () => {
  test("splits on commas, trims and skips empty items", () => {
    assert.deepEqual(
      parseBindingList(" mod+y ,mod+shift+z,, "),
      ["mod+y", "mod+shift+z"]
    );
    assert.deepEqual(parseBindingList(""), []);
  });
});
