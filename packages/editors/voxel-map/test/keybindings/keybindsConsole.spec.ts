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
import { keybindsConsole } from "../../src/keybindings/keybindsConsole.ts";
import { KEY_BINDINGS_STORAGE_KEY } from "../../src/keybindings/MapKeyBindings.ts";
import { EditorState } from "../../src/state/EditorState.ts";

function boot(
  storage = new MemoryStorageAdapter()
) {
  const commands = new CommandConsole();
  const state = new EditorState({ storage });
  const handle = keybindsConsole(commands, { state });

  function lastLine(): string {
    const entry = commands.scrollback.at(-1);

    return `${entry?.kind}: ${entry?.text}`;
  }

  return {
    commands,
    state,
    handle,
    lastLine
  };
}

describe("keybinds console", () => {
  test("groups each action under its feature", async() => {
    const { commands, lastLine } = boot();

    await commands.submit("keybinds.orient.rotateClockwise");
    assert.equal(lastLine(), "info: KeyE");

    await commands.submit("keybinds.edit.redo");
    assert.equal(lastLine(), "info: Mod+y Mod+Shift+z");
  });

  test("a write rebinds the action and survives a reboot", async() => {
    const storage = new MemoryStorageAdapter();
    const first = boot(storage);

    await first.commands.submit("keybinds.view.grid Digit1");
    assert.deepEqual(first.state.mapKeyBindings.chordsBoundTo("view.grid"), [
      "Digit1"
    ]);

    const second = boot(storage);
    assert.deepEqual(second.state.mapKeyBindings.chordsBoundTo("view.grid"), [
      "Digit1"
    ]);
  });

  test("a conflicting write prints an error and keeps the bindings", async() => {
    const { commands, state, lastLine } = boot();

    await commands.submit("keybinds.brush.mode g");

    assert.match(lastLine(), /^error: .*bound to both "brush\.mode" and "brush\.ghost"/);
    assert.deepEqual(state.mapKeyBindings.chordsBoundTo("brush.mode"), ["r"]);
  });

  test("reset restores one action, or every action", async() => {
    const storage = new MemoryStorageAdapter();
    const { commands, state, lastLine } = boot(storage);
    await commands.submit("keybinds.tool.brush p");
    await commands.submit("keybinds.tool.select n");

    await commands.submit("/keybinds.reset tool.brush");
    assert.equal(lastLine(), "info: tool.brush restored to b");
    assert.deepEqual(state.mapKeyBindings.chordsBoundTo("tool.select"), ["n"]);

    await commands.submit("/keybinds.reset");
    assert.deepEqual(JSON.parse(storage.get(KEY_BINDINGS_STORAGE_KEY)!), {});
  });

  test("unregister removes every keybinds namespace", () => {
    const { commands, handle } = boot();

    handle.unregister();

    assert.equal(commands.registry.namespace("keybinds"), undefined);
    assert.equal(commands.registry.namespace("keybinds.brush"), undefined);
  });
});
