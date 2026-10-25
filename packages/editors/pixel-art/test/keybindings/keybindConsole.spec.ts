// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { CommandConsole } from "@jolly-pixel/console";
import { followKeyBindings } from "@jolly-pixel/editor.host";
import { Preferences } from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import { PIXEL_ART_KEYBINDINGS } from "../../src/preferences.ts";
import { pixelArtConsole } from "../../src/console/pixelArtConsole.ts";
import { UvNetLibrary } from "../../src/uv/nets/UvNetLibrary.ts";

// CONSTANTS
const kScope = "pixel-art-keybindings";

function boot(
  preferences = new Preferences()
) {
  const commands = new CommandConsole();
  const keyBindingSettings = followKeyBindings(
    preferences,
    PIXEL_ART_KEYBINDINGS
  );
  pixelArtConsole(commands, {
    keyBindingSettings,
    uvNets: new UvNetLibrary()
  });

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
    const { commands } = boot();
    await commands.submit("pixelart.keybinds.selectAll");

    assert.equal(lastLine(commands), "info: Mod+a");
    assert.notEqual(commands.registry.resolveCommand("pixelart.keybinds.reset"), undefined);
  });

  test("a read prints every binding of the action", async() => {
    const { commands } = boot();

    await commands.submit("pixelart.keybinds.redo");

    assert.equal(lastLine(commands), "info: Mod+y Mod+Shift+z");
  });

  test("a write survives a reboot on the same preferences", async() => {
    const preferences = new Preferences();
    const first = boot(preferences);

    await first.commands.submit("pixelart.keybinds.undo \"Mod+u\"");
    await first.commands.submit("pixelart.keybinds.redo Mod+y Mod+Shift+u");
    assert.equal(lastLine(first.commands), "info: Mod+y Mod+Shift+u");

    const second = boot(preferences);
    assert.deepEqual(second.keyBindingSettings.keyBindings.overrides, {
      undo: ["Mod+u"],
      redo: ["Mod+y", "Mod+Shift+u"]
    });
    assert.deepEqual(second.keyBindingSettings.chordsBoundTo("undo"), ["Mod+u"]);
  });

  test("a conflict prints the KeyChordConflictError message and stores nothing", async() => {
    const preferences = new Preferences();
    const { commands, keyBindingSettings } = boot(preferences);

    await commands.submit("pixelart.keybinds.copy \"Mod+z\"");

    assert.equal(
      lastLine(commands),
      "error: Key chord \"Mod+z\" is bound to both \"copy\" and \"undo\""
    );
    assert.deepEqual(keyBindingSettings.chordsBoundTo("copy"), ["Mod+c"]);
    assert.deepEqual(preferences.overrides(kScope), {});
  });

  test("an empty value unbinds the action", async() => {
    const { commands, keyBindingSettings } = boot();

    await commands.submit("pixelart.keybinds.delete \"\"");

    assert.deepEqual(keyBindingSettings.chordsBoundTo("delete"), []);
    assert.deepEqual(keyBindingSettings.keyBindings.overrides, { delete: [] });
  });

  test("a malformed binding prints the InvalidKeyChordError message", async() => {
    const { commands } = boot();

    await commands.submit("pixelart.keybinds.undo \"mod+z\"");

    assert.equal(lastLine(commands), "error: Invalid key chord: \"mod+z\"");
  });

  test("/pixelart.keybinds.reset restores one action and clears its stored entry", async() => {
    const preferences = new Preferences();
    const { commands, keyBindingSettings } = boot(preferences);
    await commands.submit("pixelart.keybinds.undo \"Mod+u\"");
    await commands.submit("pixelart.keybinds.delete \"Backspace\"");

    await commands.submit("/pixelart.keybinds.reset undo");

    assert.equal(lastLine(commands), "info: undo restored to Mod+z");
    assert.deepEqual(keyBindingSettings.keyBindings.overrides, { delete: ["Backspace"] });
    assert.deepEqual(preferences.overrides(kScope), { delete: ["Backspace"] });
  });

  test("/pixelart.keybinds.reset without an action restores every shortcut", async() => {
    const preferences = new Preferences();
    const { commands, keyBindingSettings } = boot(preferences);
    await commands.submit("pixelart.keybinds.undo \"Mod+u\"");
    await commands.submit("pixelart.keybinds.delete \"Backspace\"");

    await commands.submit("/pixelart.keybinds.reset");

    assert.equal(lastLine(commands), "info: Every shortcut restored");
    assert.deepEqual(keyBindingSettings.keyBindings.overrides, {});
    assert.deepEqual(preferences.overrides(kScope), {});
  });
});
