// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { CommandConsole } from "@jolly-pixel/console";
import { Preferences } from "@jolly-pixel/preferences";
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  textureConsole,
  textureShortcutsConsole
} from "../../../src/features/texture/textureConsole.ts";
import { EditorState } from "../../../src/state/EditorState.ts";

describe("texture console", () => {
  test("exposes the pixel-art shortcuts of the texture panel", async() => {
    const commands = new CommandConsole();
    const state = new EditorState({
      storage: new MemoryStorageAdapter(),
      preferences: new Preferences()
    });
    const handle = textureShortcutsConsole(commands, { state });

    await commands.submit("pixelart.keybinds.undo \"Mod+u\"");

    assert.deepEqual(state.pixelArtKeyBindings.chordsBoundTo("undo"), ["Mod+u"]);

    handle.unregister();

    assert.equal(commands.registry.namespace("pixelart"), undefined);
  });

  test("uvSync switches the UV write mode of the blocks", async() => {
    const commands = new CommandConsole();
    const state = new EditorState({
      storage: new MemoryStorageAdapter(),
      preferences: new Preferences()
    });
    const handle = textureConsole(commands, { state });

    await commands.submit("texture.uvSync live");
    assert.equal(state.uvSync.value, "live");

    await commands.submit("texture.uvSync realtime");
    assert.equal(state.uvSync.value, "live");

    handle.unregister();

    assert.equal(commands.registry.namespace("texture"), undefined);
  });

  test("tabs switches the blockset tab style and saves it", async() => {
    const commands = new CommandConsole();
    const storage = new MemoryStorageAdapter();
    const state = new EditorState({
      storage,
      preferences: new Preferences()
    });
    textureConsole(commands, { state });

    await commands.submit("texture.tabs line");

    assert.equal(state.textureTabs.value, "line");
    assert.equal(storage.get("voxel-map:texture-tabs"), "line");
  });
});
