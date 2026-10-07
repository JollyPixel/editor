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
import { textureConsole } from "../../../src/features/texture/textureConsole.ts";
import { EditorState } from "../../../src/state/EditorState.ts";

describe("texture console", () => {
  test("exposes the pixel-art shortcuts of the texture panel", async() => {
    const commands = new CommandConsole();
    const state = new EditorState({ storage: new MemoryStorageAdapter() });
    const handle = textureConsole(commands, { state });

    await commands.submit("pixelart.keybinds.undo \"Mod+u\"");

    assert.deepEqual(state.pixelArtKeyBindings.chordsBoundTo("undo"), ["Mod+u"]);

    handle.unregister();

    assert.equal(commands.registry.namespace("pixelart"), undefined);
  });
});
