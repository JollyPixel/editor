// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  KeyBindings,
  isApplePlatform
} from "@jolly-pixel/controls";
import { followKeyBindings } from "@jolly-pixel/editor.host";
import { Preferences } from "@jolly-pixel/preferences";

// Import Internal Dependencies
import { VOXEL_MODEL_KEYBINDINGS } from "#src/preferences.ts";
import { historyShortcuts } from "#src/features/history/index.ts";
import { animationShortcuts } from "#src/features/animation/index.ts";
import { BlockSelectionStore } from "#src/state/index.ts";

// CONSTANTS
const kMod: KeyboardEventInit = isApplePlatform() ?
  { metaKey: true } :
  { ctrlKey: true };

function setup() {
  const preferences = new Preferences();
  const keyboard = new KeyBindings();
  const calls: string[] = [];
  const selection = new BlockSelectionStore();
  selection.select("arm");
  followKeyBindings(preferences, VOXEL_MODEL_KEYBINDINGS).bind(keyboard, {
    ...historyShortcuts({
      history: {
        undo: () => calls.push("undo") > 0,
        redo: () => calls.push("redo") > 0
      }
    }),
    ...animationShortcuts({
      selection,
      keyer: {
        keyBlock: (id) => calls.push(`key ${id}`) > 0
      }
    })
  });

  function press(
    init: KeyboardEventInit
  ): void {
    keyboard.dispatch(new KeyboardEvent("keydown", {
      cancelable: true,
      ...init
    }));
  }

  return { preferences, calls, press };
}

describe("voxel-model key bindings", () => {
  test("undoes, redoes and keys the selected block on the default chords", () => {
    const { calls, press } = setup();

    press({ code: "KeyZ", key: "z", ...kMod });
    press({ code: "KeyY", key: "y", ...kMod });
    press({ code: "KeyZ", key: "Z", shiftKey: true, ...kMod });
    press({ code: "KeyK", key: "k" });

    assert.deepEqual(calls, ["undo", "redo", "redo", "key arm"]);
  });

  test("follows a rebind made in the Settings tab", () => {
    const { preferences, calls, press } = setup();

    preferences.receive("voxel-model-keybindings", {
      "animation.key": ["j"]
    });
    press({ code: "KeyK", key: "k" });
    press({ code: "KeyJ", key: "j" });

    assert.deepEqual(calls, ["key arm"]);
  });
});
